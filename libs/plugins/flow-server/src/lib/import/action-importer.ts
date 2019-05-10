import { isEmpty } from 'lodash';
import { ContributionType } from '@flogo-web/core';
import {
  Resource,
  ResourceImportContext,
  LINK_TYPE,
  fromStandardTypeMapper,
  createValidator,
  Schemas,
  ValidationRuleFactory,
  ValidationError,
  ImportsRefAgent,
} from '@flogo-web/lib-server/core';
import {
  FlowData,
  actionHasSubflowTasks,
  forEachSubflowTaskInAction,
  Task,
} from '@flogo-web/plugins/flow-core';

import { TaskConverter } from './task-converter';

export class ActionImporter {
  protected activitySchemasByRef: Map<string, any>;

  constructor(
    private taskConverterFactory: (resourceTask, activitySchema) => TaskConverter
  ) {}

  importAction(inResource: Resource, context: ResourceImportContext): Resource<FlowData> {
    const validate = makeValidator(
      Array.from(context.contributions.keys()),
      context.importsRefAgent
    );
    const errors = validate(inResource);
    if (errors) {
      throw new ValidationError('Flow data validation errors', errors);
    }
    this.activitySchemasByRef = context.contributions;
    let resource = this.resourceToAction(inResource, context.importsRefAgent);
    if (actionHasSubflowTasks(resource.data)) {
      resource = this.reconcileSubflowTasksInAction(
        resource,
        context.normalizedResourceIds
      );
    }
    return resource;
  }

  reconcileSubflowTasksInAction(
    resource: Resource<FlowData>,
    actionsByOriginalId: Map<string, string>
  ): Resource<FlowData> {
    forEachSubflowTaskInAction(resource.data, task => {
      const originalFlowPath = task.settings.flowPath;
      task.settings.flowPath = actionsByOriginalId.get(originalFlowPath);
    });
    return resource;
  }

  resourceToAction(
    resource: Resource,
    importsRefAgent: ImportsRefAgent
  ): Resource<FlowData> {
    const resourceData: any = resource.data || {};
    const errorHandler = this.getErrorHandler(resourceData, importsRefAgent);
    return {
      ...resource,
      metadata: this.extractMetadata(resource),
      data: {
        tasks: this.mapTasks(resourceData.tasks, importsRefAgent),
        links: this.mapLinks(resourceData.links),
        errorHandler,
      },
    };
  }

  getErrorHandler(resourceData, importsRefAgent) {
    const { errorHandler } = resourceData;
    if (isEmpty(errorHandler) || isEmpty(errorHandler.tasks)) {
      return undefined;
    }
    return {
      tasks: this.mapTasks(errorHandler.tasks, importsRefAgent),
      links: this.mapLinks(errorHandler.links),
    };
  }

  mapLinks(resourceLinks = []) {
    return resourceLinks.map((link, index) => ({
      id: index,
      ...link,
      type: fromStandardTypeMapper.linkTypes[link.type || LINK_TYPE.SUCCESS],
    }));
  }

  extractMetadata(resourceData) {
    const metadata = { ...resourceData.metadata };
    metadata.input = metadata.input || [];
    metadata.output = metadata.output || [];
    return metadata;
  }

  mapTasks(tasks = [], importsRefAgent: ImportsRefAgent): Task[] {
    return tasks.map(task => this.convertTask(task, importsRefAgent) as Task);
  }

  convertTask(resourceTask, importsRefAgent: ImportsRefAgent) {
    resourceTask.activity.ref = importsRefAgent.getPackageRef(
      ContributionType.Activity,
      resourceTask.activity.ref
    );
    const activitySchema = this.activitySchemasByRef.get(resourceTask.activity.ref);
    return this.taskConverterFactory(resourceTask, activitySchema).convert();
  }
}

function makeValidator(installedRefs: string[], importsRefAgent: ImportsRefAgent) {
  return createValidator(
    {
      $schema: 'http://json-schema.org/draft-07/schema#',
      $id: 'http://github.com/project-flogo/flogo-web/schemas/1.0.0/flowResource.json',
      additionalProperties: true,
      required: ['data'],
      properties: {
        data: {
          $ref: 'flow.json',
        },
      },
    },
    {
      removeAdditional: true,
      schemas: [Schemas.v1.flow, Schemas.v1.common],
    },
    [
      {
        keyword: 'activity-installed',
        validate: ValidationRuleFactory.contributionInstalled(
          'activity-installed',
          'activity',
          installedRefs || [],
          ref => importsRefAgent.getPackageRef(ContributionType.Activity, ref)
        ),
      },
    ]
  );
}

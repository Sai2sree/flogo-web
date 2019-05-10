import { isEmpty, pick } from 'lodash';
import {
  ResourceExportContext,
  Resource,
  ExportRefAgent,
} from '@flogo-web/lib-server/core';
import {
  App,
  FlogoAppModel,
  ContributionSchema,
  ContributionType,
  Handler,
  Trigger,
} from '@flogo-web/core';

import { ResourceExporterFn, HandlerExporterFn } from '../resource-exporter-fn';
import { makeHandlerFormatter } from './handler-format';
import { ExportedResourceInfo } from './exported-resource-info';
import { createRefAgent, RefAgent } from '../ref-agent';
import { APP_MODEL_VERSION } from '../../../../common/constants';
import { ParsedImport } from '../../common/parsed-import';
import { formatImports } from '../utils/format-imports';

const TRIGGER_KEYS: Array<keyof FlogoAppModel.Trigger> = [
  'id',
  'ref',
  'name',
  'description',
  'settings',
  'handlers',
];

export class AppFormatter {
  constructor(
    private contributionSchemas: Map<string, ContributionSchema>,
    private resourceTypeToRef: Map<string, string>,
    private exporter: {
      resource: ResourceExporterFn;
      handler: HandlerExporterFn;
    }
  ) {}

  format(app: App, resourceIdReconciler: Map<string, Resource>): FlogoAppModel.App {
    const refAgent: RefAgent = createRefAgent(this.contributionSchemas, app.imports);
    const exportContext: ResourceExportContext = {
      contributions: this.contributionSchemas,
      resourceIdReconciler,
      refAgent,
    };

    const { resources, resourceInfoLookup } = this.formatResources(
      app.resources,
      exportContext
    );

    const formattedTriggers = this.formatTriggers(
      app.triggers,
      refAgent,
      this.makeHandlerFormatter(resourceIdReconciler, resourceInfoLookup, refAgent)
    );

    const allImports = this.formatImports(refAgent.dumpImports());

    return {
      name: app.name,
      type: 'flogo:app',
      version: app.version,
      appModel: APP_MODEL_VERSION,
      description: app.description,
      properties: !isEmpty(app.properties) ? app.properties : undefined,
      imports: !isEmpty(allImports) ? allImports : undefined,
      triggers: !isEmpty(formattedTriggers) ? formattedTriggers : undefined,
      resources: !isEmpty(resources) ? resources : undefined,
    };
  }

  formatResources(resources: Resource[], exportContext: ResourceExportContext) {
    const resourceInfoLookup = new Map<string, ExportedResourceInfo>();
    const exportedResources: FlogoAppModel.Resource[] = [];
    resources.forEach(resource => {
      const exportedResource = this.exporter.resource(resource, exportContext);
      resourceInfoLookup.set(resource.id, {
        resource: exportedResource,
        type: resource.type,
        ref: this.resourceTypeToRef.get(resource.type),
      });
      exportedResources.push(this.exporter.resource(resource, exportContext));
    });
    return { resources: exportedResources, resourceInfoLookup };
  }

  formatTriggers(
    triggers: Trigger[],
    refAgent: ExportRefAgent,
    handlerFormatter: (trigger: Trigger) => (handler: Handler) => FlogoAppModel.Handler
  ): FlogoAppModel.Trigger[] {
    return triggers
      .filter(trigger => !isEmpty(trigger.handlers))
      .map(trigger => {
        return pick(
          {
            ...trigger,
            settings: !isEmpty(trigger.settings) ? trigger.settings : undefined,
            handlers: trigger.handlers.map(handlerFormatter(trigger)),
            ref: refAgent.getAliasRef(ContributionType.Trigger, trigger.ref),
          },
          TRIGGER_KEYS
        ) as FlogoAppModel.Trigger;
      });
  }

  formatImports(parsedImports: Array<ParsedImport>): string[] {
    const hasLegacyImports = !!parsedImports.find(parsedImport => {
      const schema = this.contributionSchemas.get(parsedImport.ref);
      return schema && schema.isLegacy;
    });

    if (hasLegacyImports) {
      parsedImports = [
        ...parsedImports,
        { ref: 'github.com/project-flogo/legacybridge', isAliased: false, type: null },
      ];
    }

    return formatImports(parsedImports);
  }

  private makeHandlerFormatter(
    resourceIdReconciler: Map<string, Resource>,
    resourceInfoLookup: Map<string, ExportedResourceInfo>,
    refAgent: ExportRefAgent
  ) {
    return makeHandlerFormatter({
      exportHandler: this.exporter.handler,
      contributionSchemas: this.contributionSchemas,
      refAgent: refAgent,
      getResourceInfo: oldResourceId =>
        resourceInfoLookup.get(resourceIdReconciler.get(oldResourceId).id),
    });
  }
}

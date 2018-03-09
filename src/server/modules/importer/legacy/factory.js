import { fullAppSchema } from '../../apps/schemas';

import { validatorFactory } from '../validator';

import { extractContribRefs } from '../common/extract-contrib-refs';

import { ActionsImporter } from './actions-importer';
import { TriggersHandlersImporter } from './triggers-handlers-importer';
import { loadMicroserviceContribs } from '../common/load-microservice-contribs';

export class LegacyAppImporterFactory {

  /**
   * @param {ResourceStorageRegistry} resourceStorageRegistry
   */
  constructor(resourceStorageRegistry) {
    this.resourceStorageRegistry = resourceStorageRegistry;
  }

  async create() {
    const actionsImporter = this.createActionsImporter(
      this.resourceStorageRegistry.getActionsManager(),
    );
    const triggersHandlersImporter = this.createTriggersHandlersImporter(
      this.resourceStorageRegistry.getAppsTriggersManager(),
      this.resourceStorageRegistry.getHandlersManager(),
    );
    const contributions = await this.loadContributions();
    const validator = this.createValidator(contributions);
    return {
      actionsImporter,
      triggersHandlersImporter,
      validator,
    };
  }

  async loadContributions() {
    return loadMicroserviceContribs(
      this.getActivitiesManager(),
      this.getTriggersManager(),
    );
  }

  getTriggersManager() {
    return this.resourceStorageRegistry.getContribTriggersManager();
  }

  getActivitiesManager() {
    return this.resourceStorageRegistry.getContribActivitiesManager();
  }

  createValidator(contributions) {
    const contribRefs = {
      activities: extractContribRefs(contributions.activities),
      triggers: extractContribRefs(contributions.triggers),
    };
    return validatorFactory(fullAppSchema, contribRefs);
  }

  createActionsImporter(actionsManager) {
    return new ActionsImporter(actionsManager);
  }

  createTriggersHandlersImporter(appsTriggersManager, handlersManager) {
    return new TriggersHandlersImporter(appsTriggersManager, handlersManager);
  }
}
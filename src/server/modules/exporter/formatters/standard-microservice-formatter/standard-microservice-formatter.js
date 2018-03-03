import isEmpty from 'lodash/isEmpty';
import { ensureKeyOrder } from '../../../../common/utils/object';
import { formatHandler } from './format-handler';
import { formatResource } from './fromat-resource';

const APP_MODEL_VERSION = '1.0.0';
const APP_KEY_ORDER = ['name', 'type', 'version', 'appModel', 'description', 'triggers', 'resources'];
const TRIGGER_KEY_ORDER = ['id', 'ref', 'name', 'description', 'settings', 'handlers'];

export class StandardMicroServiceFormatter {
  preprocess(app) {
    return app;
  }

  format(app) {
    app.appModel = APP_MODEL_VERSION;
    app.description = !isEmpty(app.description) ? app.description : undefined;

    const formattedTriggers = this.formatTriggers(app.triggers);
    app.triggers = !isEmpty(formattedTriggers) ? formattedTriggers : undefined;

    const resources = this.formatResources(app.actions);
    app.resources = !isEmpty(resources) ? resources : undefined;

    return ensureKeyOrder(app, APP_KEY_ORDER);
  }

  formatTriggers(triggers) {
    return triggers
      .filter(trigger => !isEmpty(trigger.handlers))
      .map(trigger => {
        const formattedTrigger = {
          ...trigger,
          handlers: trigger.handlers.map(formatHandler),
        };
        return ensureKeyOrder(formattedTrigger, TRIGGER_KEY_ORDER);
      });
  }

  formatResources(actions) {
    return actions.map(formatResource);
  }
}

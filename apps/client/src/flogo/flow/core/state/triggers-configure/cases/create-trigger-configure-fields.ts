import {
  Dictionary,
  TriggerSchema,
  SchemaAttribute,
  TriggerHandler,
} from '@flogo-web/client-core';
import { Trigger } from '../../../interfaces';
import { ConfigureTriggerDetails } from '../../../../triggers/configurator/interfaces';

export function createTriggerConfigureFields(
  triggerInstance: Trigger,
  handlerInstance: TriggerHandler,
  schema: TriggerSchema
): ConfigureTriggerDetails['fields'] {
  const { name, description, settings: common } = triggerInstance;
  const { settings: handlerSettings } = handlerInstance;
  const { settings: triggerSettingsSchema, handler } = schema;
  const { settings: handlerSettingsSchema } = handler;
  return {
    settings: {
      name: createField(name),
      description: createField(description),
      triggerSettings: groupBySettings(triggerSettingsSchema || [], common),
      handlerSettings: groupBySettings(handlerSettingsSchema || [], handlerSettings),
    },
    flowInputMappings: null,
    flowOutputMappings: null,
  };
}

function mergeSettingsWithSchema(schemaAttributes, instanceProperties) {
  return schemaAttributes
    .map(schemaAttribute => {
      return [schemaAttribute.name, instanceProperties[schemaAttribute.name]];
    })
    .reduce((props, [name, value]) => {
      props[name] = value;
      return props;
    }, {});
}

function groupBySettings(schema: SchemaAttribute[], instanceProperties: Dictionary<any>) {
  const mergedSettings = mergeSettingsWithSchema(schema, instanceProperties);
  return Object.keys(mergedSettings).reduce((props, name) => {
    props[name] = createField(mergedSettings[name]);
    return props;
  }, {});
}

function createField(value) {
  return {
    isDirty: false,
    isValid: true,
    isEnabled: true,
    value,
  };
}

import { Dictionary, SchemaAttribute, TriggerSchema } from '@flogo-web/client-core';
import { ValidatorFn } from '@angular/forms';
import {
  TriggerConfigureTab,
  TriggerConfigureField,
  TriggerConfigureFields,
  TriggerConfigureTabType,
} from '@flogo-web/client/flow/core';

export interface ConfigureTriggerDetails {
  tabs: TriggerConfigureTab[];
  fields: {
    [tabName in TriggerConfigureTabType]: {
      [fieldName: string]: TriggerConfigureFields | TriggerConfigureField;
    }
  };
  schema: TriggerSchema;
}

export type SettingControlGroupType = 'triggerSettings' | 'handlerSettings';
export enum SettingControlGroup {
  TRIGGER = 'triggerSettings',
  HANDLER = 'handlerSettings',
}
export interface SettingControlInfo extends SchemaAttribute {
  propsAllowed: string[];
  validations: ValidatorFn[];
}

export interface TriggerInformation {
  settingsControls: {
    [groupType in SettingControlGroupType]: Dictionary<SettingControlInfo>
  };
  trigger: {
    handlersCount: number;
    homePage: string;
    readme?: string;
  };
}

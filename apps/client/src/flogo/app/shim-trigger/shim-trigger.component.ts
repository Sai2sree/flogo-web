import { flatMap, map, defaults } from 'lodash';
import { Component, HostBinding, Inject } from '@angular/core';
import { CONTRIB_REF_PLACEHOLDER, LanguageService } from '@flogo-web/client-core';
import { MODAL_TOKEN, modalAnimate, ModalControl } from '@flogo-web/client-core/modal';

export interface ShimTriggerData {
  shimTriggersList: any[];
  buildOptions: any[];
}

@Component({
  selector: 'flogo-trigger-shim-build',
  templateUrl: 'shim-trigger.component.html',
  styleUrls: ['shim-trigger.component.less'],
  animations: modalAnimate,
})
export class TriggerShimBuildComponent {
  @HostBinding('@modalAnimate')
  displayOptions: any;
  isLambdaTrigger: boolean;
  isTriggerSelected: boolean;

  constructor(
    @Inject(MODAL_TOKEN) public shimTriggerData: ShimTriggerData,
    public control: ModalControl,
    public translate: LanguageService
  ) {
    this.shimTriggerData.shimTriggersList = flatMap(
      this.shimTriggerData.shimTriggersList,
      shimTriggerList =>
        map(shimTriggerList.flows, flow =>
          defaults(
            { configuredTrigger: shimTriggerList.trigger },
            { configuredFlow: flow }
          )
        )
    );
    if (this.shimTriggerData.shimTriggersList.length === 1) {
      this.displayOptions = {
        triggerName: this.shimTriggerData.shimTriggersList[0].configuredTrigger.name,
        triggerId: this.shimTriggerData.shimTriggersList[0].configuredTrigger.id,
        flowName: this.shimTriggerData.shimTriggersList[0].configuredFlow.name,
      };
      this.isTriggerSelected = true;
    } else {
      this.displayOptions = {};
      this.isTriggerSelected = false;
    }
    this.isLambdaTrigger = false;
  }

  onTriggerSelectionFinish(trigger) {
    if (trigger.configuredTrigger.ref === CONTRIB_REF_PLACEHOLDER.REF_LAMBDA) {
      this.isLambdaTrigger = true;
      this.control.close({ triggerId: trigger.configuredTrigger.id });
    } else {
      this.displayOptions = {
        triggerName: trigger.configuredTrigger.name,
        triggerId: trigger.configuredTrigger.id,
        flowName: trigger.configuredFlow.name,
      };
      this.isTriggerSelected = true;
      this.isLambdaTrigger = false;
    }
  }

  onBuildEnvSelection(env, triggerId) {
    this.control.close({
      triggerId: triggerId,
      env: { os: env.os, arch: env.arch },
    });
  }
}

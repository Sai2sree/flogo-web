import { assign, cloneDeep, each, find, pick } from 'lodash';
import {Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { from } from 'rxjs/observable/from';
import { takeUntil, mergeMap, switchMap } from 'rxjs/operators';
import { Store } from '@ngrx/store';

import { LanguageService, FlowMetadata } from '@flogo/core';
import { TriggersApiService } from '@flogo/core/services';
import {FLOGO_PROFILE_TYPE, TRIGGER_MENU_OPERATION} from '@flogo/core/constants';
import { notification, objectFromArray } from '@flogo/shared/utils';
import {RESTAPIHandlersService} from '@flogo/core/services/restapi/v2/handlers-api.service';

import {PostService} from '@flogo/core/services/post.service';
import { SingleEmissionSubject } from '@flogo/core/models/single-emission-subject';
import {UIModelConverterService} from '@flogo/flow/core/ui-model-converter.service';

import {
SUB_EVENTS as FLOGO_SELECT_TRIGGER_PUB_EVENTS,
PUB_EVENTS as FLOGO_SELECT_TRIGGER_SUB_EVENTS
} from '../trigger-detail/messages';

import { PUB_EVENTS as FLOGO_TASK_SUB_EVENTS, SUB_EVENTS as FLOGO_TASK_PUB_EVENTS} from '../shared/form-builder/messages';
import { AppState } from '../core/state/app.state';

import {IPropsToUpdateFormBuilder} from '../flow.component';
import { Trigger, TriggerHandler } from '../core';
import {TriggerMenuSelectionEvent} from '@flogo/flow/triggers/trigger-block/models';
import { ConfiguratorService as TriggersConfiguratorService } from './configurator/configurator.service';
import { SaveData } from './configurator/interfaces';
import { RenderableTrigger } from './interfaces/renderable-trigger';
import { getTriggersState } from './state/triggers.selectors';
import * as TriggerActions from '../core/state/triggers.actions';

@Component({
  selector : 'flogo-flow-triggers',
  templateUrl : 'triggers.component.html',
  styleUrls : [ 'triggers.component.less' ]
})
export class FlogoFlowTriggersPanelComponent implements OnInit, OnDestroy {
  actionId: string;
  appDetails: {appId: string, appProfileType:  FLOGO_PROFILE_TYPE, metadata?: FlowMetadata};
  triggersList: RenderableTrigger[] = [];
  allowMultipleTriggers = true;
  currentTrigger: RenderableTrigger;
  showAddTrigger = false;
  installTriggerActivated = false;

  private _subscriptions: any[];
  private ngDestroy$ = SingleEmissionSubject.create();

  constructor(private _restAPITriggersService: TriggersApiService,
              private _restAPIHandlerService: RESTAPIHandlersService,
              private _converterService: UIModelConverterService,
              private _router: Router,
              private _translate: LanguageService,
              private _postService: PostService,
              private _triggerConfiguratorService: TriggersConfiguratorService,
              private store: Store<AppState>) {
  }

  ngOnInit() {
    this.initSubscribe();

    this.store
      .select(getTriggersState)
      .pipe(takeUntil(this.ngDestroy$))
      .subscribe(triggerState => {
        this.actionId = triggerState.actionId;
        this.triggersList = triggerState.triggers;
        const prevTrigger = this.currentTrigger;
        this.currentTrigger = triggerState.currentTrigger;
        if (prevTrigger !== this.currentTrigger) {
          this.onSelectionChange(prevTrigger);
        }
        this.appDetails = {
          appId: triggerState.appId,
          appProfileType: triggerState.appProfileType,
          metadata: triggerState.flowMetadata,
        };
        this.manageAddTriggerInView();
      });
  }

  ngOnDestroy() {
    this._subscriptions.forEach(
      ( sub: any ) => {
        this._postService.unsubscribe( sub );
      }
    );
    this.ngDestroy$.emitAndComplete();
  }

  get isDeviceType() {
    return this.appDetails.appProfileType === FLOGO_PROFILE_TYPE.DEVICE;
  }

  private initSubscribe() {
    this._subscriptions = [];

    const subs = [
      assign({}, FLOGO_SELECT_TRIGGER_SUB_EVENTS.triggerAction , { callback: this._onActionTrigger.bind(this) }),
      assign({}, FLOGO_TASK_SUB_EVENTS.changeTileDetail, { callback: this._changeTileDetail.bind(this) }),
      assign({}, FLOGO_TASK_SUB_EVENTS.triggerDetailsChanged, { callback: this._taskDetailsChanged.bind(this) })
    ];

    each(
      subs, sub => {
        this._subscriptions.push(this._postService.subscribe(sub));
      }
    );

    this._triggerConfiguratorService.save$
      .pipe(
        takeUntil(this.ngDestroy$),
        switchMap(saveData => from(saveData)),
        mergeMap((modifiedTrigger: SaveData) => this._restAPIHandlerService
          .updateHandler(modifiedTrigger.trigger.id, this.actionId, modifiedTrigger.mappings)
          .then((updatedHandler) => ({ triggerId: modifiedTrigger.trigger.id, updatedHandler })))
      )
      .subscribe(({ updatedHandler, triggerId }) => {
        this.store.dispatch(new TriggerActions.UpdateHandler({
          triggerId,
          handler: updatedHandler,
        }));
    });
  }

  private _taskDetailsChanged(data: any, envelope: any) {
    // console.group('Save trigger details to flow');
    // if (data.changedStructure === 'settings') {
    //   this._restAPITriggersService.updateTrigger(this.currentTrigger.id, {settings: data.settings}).then(() => {
    //     const existingTrigger = this.triggers.find(t => t.id === this.currentTrigger.id);
    //     existingTrigger.settings = data.settings;
    //     this.modifyTriggerInTriggersList(data.changedStructure, existingTrigger);
    //   });
    // } else if (data.changedStructure === 'endpointSettings' || data.changedStructure === 'outputs') {
    //   this._restAPIHandlerService.updateHandler(this.currentTrigger.id, this.actionId, {
    //     settings: data.endpointSettings,
    //     outputs: data.outputs
    //   }).then(() => {
    //     const existingTrigger = this.triggers.find(t => t.id === this.currentTrigger.id);
    //     const existingHandler = existingTrigger.handlers.find(h => h.actionId === this.actionId);
    //     existingHandler.settings = data.endpointSettings;
    //     existingHandler.outputs = data.outputs;
    //     this.modifyTriggerInTriggersList(data.changedStructure, existingTrigger);
    //   });
    //
    // }
    //
    // if (isFunction(envelope.done)) {
    //   envelope.done();
    // }
    // console.groupEnd();
  }

  private _changeTileDetail(data: {
    content: string,
    proper: string,
    taskId: any,
    id: string,
    tileType: string
  }, envelope: any) {
    // if (data.tileType === 'trigger') {
    //   let resultantPromise;
    //   if (data.proper === 'name') {
    //     resultantPromise = this._restAPITriggersService.updateTrigger(this.currentTrigger.id, {name: data.content});
    //   } else if (data.proper === 'description') {
    //     resultantPromise = this._restAPITriggersService.updateTrigger(this.currentTrigger.id, {description: data.content});
    //   }
    //
    //   const existingTrigger = this.triggers.find(t => t.id === this.currentTrigger.id);
    //   resultantPromise.then(() => {
    //     existingTrigger[data.proper] = data.content;
    //     this.modifyTriggerInTriggersList(data.proper, existingTrigger);
    //   }).catch(() => {
    //     if (data.proper === 'name') {
    //       const message = this._translate.instant('TRIGGERS-PANEL:TRIGGER-EXISTS');
    //       notification(message, 'error');
    //       const propsToUpdateFormBuilder: IPropsToUpdateFormBuilder = <IPropsToUpdateFormBuilder> {
    //         name: existingTrigger.name
    //       };
    //       this._postService.publish(
    //         assign(
    //           {}, FLOGO_TASK_PUB_EVENTS.updatePropertiesToFormBuilder, {
    //             data: propsToUpdateFormBuilder
    //           }
    //         )
    //       );
    //     }
    //   });
    //
    //   if (isFunction(envelope.done)) {
    //     envelope.done();
    //   }
    //   console.groupEnd();
    // }
  }

  private manageAddTriggerInView() {
    this.allowMultipleTriggers = !(this.isDeviceType && this.triggersList.length > 0);
  }

  openInstallTriggerWindow() {
    this.installTriggerActivated = true;
    this.closeAddTriggerModal(false);
  }

  onTriggerInstalledAction() {
    this.installTriggerActivated = false;
    this.openAddTriggerModal();
  }

  openAddTriggerModal() {
    this.showAddTrigger = true;
  }

  closeAddTriggerModal(showAddTrigger: boolean) {
    this.showAddTrigger = showAddTrigger;
  }

  addTriggerToAction(data) {
    const settings = objectFromArray(data.triggerData.endpoint.settings, false);
    const outputs = objectFromArray(data.triggerData.outputs, false);
    let resultantPromiseState;
    let triggerId;
    if (data.installType === 'installed') {
      const appId = this.appDetails.appId;
      const triggerInfo: any = pick(data.triggerData, ['name', 'ref', 'description']);
      triggerInfo.settings = objectFromArray(data.triggerData.settings || [], false);

      resultantPromiseState = this._restAPITriggersService.createTrigger(appId, triggerInfo)
        .then( (triggerResult) => {
          triggerId = triggerResult.id;
          return this._restAPIHandlerService.updateHandler(triggerId, this.actionId, {settings, outputs});
        });
    } else {
      triggerId = data.triggerData.id;
      resultantPromiseState = this._restAPIHandlerService.updateHandler(triggerId, this.actionId, {settings, outputs});
    }
    resultantPromiseState
      .then(() => this._restAPITriggersService.getTrigger(triggerId))
      .then(trigger => {
        const handler = trigger.handlers.find(h => h.actionId === this.actionId);
        this.store.dispatch(new TriggerActions.AddTrigger({ trigger, handler }));
    });
  }

  private onSelectionChange(prevTrigger: Trigger) {
    if (prevTrigger === this.currentTrigger || !this.currentTrigger) {
      return;
    }
    if (!prevTrigger && this.currentTrigger || prevTrigger.id !== this.currentTrigger.id) {
      this.showTriggerDetails();
    }
  }

  private showTriggerDetails() {
    const currentTrigger =  cloneDeep(this.currentTrigger);
    this._router.navigate(['/flows', this.actionId, 'trigger', currentTrigger.id])
      .then(() => this._converterService.getTriggerTask(currentTrigger))
      .then((triggerForUI) => {
        const dataToPublish = {
          'id': 'root',
          'task': triggerForUI,
          'context': {
            'isTrigger': true,
            'isBranch': false,
            'isTask': false,
            'hasProcess': false,
            'isDiagramEdited': false,
            'currentTrigger': currentTrigger,
            'profileType': this.appDetails.appProfileType
          }
        };
        this._postService.publish(
          assign(
            {}, FLOGO_SELECT_TRIGGER_PUB_EVENTS.selectTrigger, {
              data: assign({}, dataToPublish)
            }
          )
        );
      });
  }

  private openTriggerMapper(selectedTrigger: Trigger) {
    Promise.all(this.triggersList.map(trigger => {
      const handler = trigger.handler;
      return this._converterService.getTriggerTask(trigger).then(triggerSchema => {
        return {trigger, handler, triggerSchema};
      });
    })).then(allTriggerDetails => {
      this._triggerConfiguratorService.open(allTriggerDetails, this.appDetails.metadata, selectedTrigger.id);
    });
  }

  private deleteHandlerForTrigger(triggerId) {
    this._restAPIHandlerService.deleteHandler(this.actionId, triggerId)
      .then(() => this._router.navigate(['/flows', this.actionId]))
      // .then(() => this._restAPITriggersService.getTrigger(triggerId))
      .then(() => this.store.dispatch(new TriggerActions.RemoveHandler(triggerId)));
  }

  private _onActionTrigger(data: any, envelope: any) {
    if (data.action !== 'trigger-copy') {
      return;
    }
    const currentTrigger = this.currentTrigger;
    this._restAPIHandlerService.deleteHandler(this.actionId, this.currentTrigger.id)
      .then(() => {
        const triggerSettings = pick(this.currentTrigger, [
          'name',
          'description',
          'ref',
          'settings'
        ]);
        return this._restAPITriggersService.createTrigger(this.appDetails.appId, triggerSettings);
      })
      .then((createdTrigger) => {
        const settings = this.getSettingsFromHandler(currentTrigger.handler);
        return this._restAPIHandlerService.updateHandler(createdTrigger.id, this.actionId, settings)
          .then(handler => ({ trigger: createdTrigger, handler }));
      })
      .then(({ trigger, handler }) => {
        this.store.dispatch(new TriggerActions.CopyTrigger({
          copiedTriggerId: currentTrigger.id,
          newTrigger: trigger,
          newHandler: handler,
        }));
        const message = this._translate.instant('CANVAS:COPIED-TRIGGER');
        notification(message, 'success', 3000);
      });
  }

  private getSettingsFromHandler(handler: TriggerHandler) {
    const settings = cloneDeep(handler.settings);
    const outputs = cloneDeep(handler.outputs);
    return {settings, outputs};
  }

  handleMenuSelection(event: TriggerMenuSelectionEvent) {
    switch (event.operation) {
      case TRIGGER_MENU_OPERATION.SHOW_SETTINGS:
        this.store.dispatch(new TriggerActions.SelectTrigger(event.trigger.id));
        break;
      case TRIGGER_MENU_OPERATION.CONFIGURE:
        this.openTriggerMapper(event.trigger);
        break;
      case TRIGGER_MENU_OPERATION.DELETE:
        this.deleteHandlerForTrigger(event.trigger.id);
        break;
      default:
        console.warn(`[TRIGGER MENU][${event.operation}] unhandled menu action.`);
        break;
    }
  }

}

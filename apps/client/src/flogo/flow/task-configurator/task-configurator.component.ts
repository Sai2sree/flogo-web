import { isEmpty, cloneDeep } from 'lodash';
import { skip, takeUntil } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { trigger, transition, style, animate } from '@angular/animations';

import {
  ActionBase,
  FLOGO_TASK_TYPE,
  Item,
  ItemActivityTask,
  ItemSubflow,
  ItemTask,
  isIterableTask,
  isMapperActivity,
  isSubflowTask,
  ActivitySchema,
  Task,
  mergeItemWithSchema,
  SingleEmissionSubject,
} from '@flogo-web/client-core';
import { NotificationsService } from '@flogo-web/client-core/notifications';

import {
  MapperTranslator,
  MapperControllerFactory,
  MapperController,
} from '../shared/mapper';
import { Tabs } from '../shared/tabs/models/tabs.model';
import { FlogoFlowService as FlowsService } from '@flogo-web/client/flow/core';
import { FlowState, FlowActions } from '@flogo-web/client/flow/core/state';
import {
  createIteratorMappingContext,
  getIteratorOutputSchema,
  ITERABLE_VALUE_KEY,
  ITERATOR_OUTPUT_KEY,
} from './models';
import { SubFlowConfig } from './subflow-config';
import {
  getFlowMetadata,
  getInputContext,
} from '@flogo-web/client/flow/core/models/task-configure/get-input-context';
import { getStateWhenConfigureChanges } from '../shared/configurator/configurator.selector';
import { createSaveAction } from '@flogo-web/client/flow/task-configurator/models/save-action-creator';
import { hasTaskWithSameName } from '@flogo-web/client/flow/core/models/unique-task-name';
import { AppState } from '@flogo-web/client/flow/core/state/app.state';

const TASK_TABS = {
  SUBFLOW: 'subFlow',
  ITERATOR: 'iterator',
  INPUT_MAPPINGS: 'inputMappings',
};
const ITERATOR_TAB_INFO = {
  name: TASK_TABS.ITERATOR,
  labelKey: 'TASK-CONFIGURATOR:TABS:ITERATOR',
};
const SUBFLOW_TAB_INFO = {
  name: TASK_TABS.SUBFLOW,
  labelKey: 'TASK-CONFIGURATOR:TABS:SUB-FLOW',
};
const MAPPINGS_TAB_INFO = {
  name: TASK_TABS.INPUT_MAPPINGS,
  labelKey: 'TASK-CONFIGURATOR:TABS:MAP-INPUTS',
};

@Component({
  selector: 'flogo-flow-task-configurator',
  styleUrls: ['../../../assets/_mapper-modal.less', 'task-configurator.component.less'],
  templateUrl: 'task-configurator.component.html',
  animations: [
    trigger('dialog', [
      transition('void => *', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('250ms ease-in'),
      ]),
      transition('* => void', [
        animate('250ms ease-in', style({ transform: 'translateY(-100%)', opacity: 0 })),
      ]),
    ]),
  ],
})
export class TaskConfiguratorComponent implements OnInit, OnDestroy {
  inputsSearchPlaceholderKey = 'TASK-CONFIGURATOR:ACTIVITY-INPUTS';
  inputScope: any[];

  tabs: Tabs;
  title: string;

  canIterate: boolean;
  initialIteratorData: {
    iteratorModeOn: boolean;
    iterableValue: string;
  };
  appId: string;
  actionId: string;
  currentTile: Task;
  activitySchemaUrl: string;
  iteratorModeOn = false;
  iterableValue: string;
  isSubflowType: boolean;
  currentSubflowSchema: ActionBase;
  subFlowConfig: SubFlowConfig;
  subflowList: ActionBase[];
  showSubflowList = false;
  isActive = false;
  flowState: FlowState;
  inputMapperController: MapperController;
  iteratorController: MapperController;
  isValidTaskName: boolean;
  isTaskDetailEdited: boolean;
  ismapperActivity: boolean;

  private inputMapperStateSubscription: Subscription;
  private contextChange$ = SingleEmissionSubject.create();
  private destroy$ = SingleEmissionSubject.create();

  constructor(
    private store: Store<AppState>,
    private _flowService: FlowsService,
    private mapperControllerFactory: MapperControllerFactory,
    private notificationsService: NotificationsService
  ) {
    this.isSubflowType = false;
    this.resetState();
  }

  ngOnInit() {
    this.store
      .pipe(
        getStateWhenConfigureChanges([
          FLOGO_TASK_TYPE.TASK,
          FLOGO_TASK_TYPE.TASK_SUB_PROC,
          FLOGO_TASK_TYPE.TASK_ITERATOR,
        ]),
        takeUntil(this.destroy$)
      )
      .subscribe(state => {
        if (state) {
          this.initConfigurator(state);
        } else if (this.isActive) {
          this.close();
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.emitAndComplete();
    if (!this.contextChange$.isStopped) {
      this.contextChange$.emitAndComplete();
    }
  }

  selectSubFlow() {
    this._flowService.listFlowsForApp(this.appId).then(flows => {
      this.subflowList = flows.filter(
        flow =>
          !(flow.id === this.actionId || flow.id === this.currentTile.settings.flowPath)
      );
      this.showSubflowList = true;
    });
  }

  subFlowChanged(event) {
    const subFlowTab = this.tabs.get(TASK_TABS.SUBFLOW);
    this.showSubflowList = false;
    subFlowTab.isDirty = true;
    this.createSubflowConfig(event);
    this.currentSubflowSchema = event;
    this.createChangedsubFlowConfig(event);
  }

  createChangedsubFlowConfig(event) {
    this.currentTile.name = event.name;
    this.currentTile.settings.flowPath = event.flowPath;
    this.currentTile.description = event.description;
    const mappings = [];
    const propsToMap = event.metadata ? event.metadata.input : [];
    this.resetInputMappingsController(propsToMap, this.inputScope, mappings);
  }

  onChangeIteratorMode() {
    this.iteratorModeOn = !this.iteratorModeOn;
    this.checkIsIteratorDirty();
    this.adjustIteratorInInputMapper();
  }

  save() {
    const isIterable = this.iteratorModeOn && !isEmpty(this.iterableValue);
    createSaveAction(this.store, {
      tileId: this.currentTile.id,
      name: this.title,
      description: this.currentTile.description,
      subflowPath: this.currentTile.settings ? this.currentTile.settings.flowPath : null,
      changedSubflowSchema: this.currentSubflowSchema,
      iterator: {
        isIterable,
        iterableValue: isIterable ? this.iterableValue : undefined,
      },
      inputMappings: MapperTranslator.translateMappingsOut(
        this.inputMapperController.getCurrentState().mappings
      ),
    }).subscribe(action => {
      this.store.dispatch(action);
    });
  }

  selectTab(name: string) {
    this.tabs.markSelected(name);
    this.showSubflowList = false;
  }

  flowSelectionCancel(event) {
    this.showSubflowList = false;
  }

  cancel() {
    this.store.dispatch(new FlowActions.CancelItemConfiguration());
  }

  trackTabsByFn(index, [tabName, tab]) {
    return tabName;
  }

  changeTaskDetail(content, property) {
    this.isTaskDetailEdited = true;
    if (property === 'name') {
      const repeatedName = hasTaskWithSameName(
        content,
        this.flowState.mainItems,
        this.flowState.errorItems
      );
      if ((repeatedName && content !== this.currentTile.name) || content === '') {
        this.isValidTaskName = false;
      } else {
        this.isValidTaskName = true;
        this.title = content;
      }
    }
  }

  private onIteratorValueChange(newValue: string, isValid: boolean) {
    this.tabs.get(TASK_TABS.ITERATOR).isValid = MapperTranslator.isValidExpression(
      newValue
    );
    this.iterableValue = newValue;
    this.checkIsIteratorDirty();
  }

  private checkIsIteratorDirty() {
    const iteratorTab = this.tabs.get(TASK_TABS.ITERATOR);
    if (!this.initialIteratorData) {
      iteratorTab.isDirty = false;
      return;
    }

    let isDirty = false;
    if (this.initialIteratorData.iteratorModeOn && !this.iteratorModeOn) {
      isDirty = true;
    } else {
      isDirty =
        this.iteratorModeOn &&
        this.iterableValue !== this.initialIteratorData.iterableValue;
    }
    iteratorTab.isDirty = isDirty;
  }

  private configureOutputMapperLabels() {
    this.inputsSearchPlaceholderKey = 'TASK-CONFIGURATOR:FLOW-OUTPUTS';
    this.tabs.get(TASK_TABS.INPUT_MAPPINGS).labelKey =
      'TASK-CONFIGURATOR:TABS:MAP-OUTPUTS';
  }

  private initConfigurator(state: FlowState) {
    this.flowState = state;
    const itemId = state.taskConfigure;
    this.ensurePreviousContextCleanup();
    this.contextChange$ = SingleEmissionSubject.create();

    const selectedItem = <ItemTask>(
      cloneDeep(state.mainItems[itemId] || state.errorItems[itemId])
    );
    const activitySchema: ActivitySchema = (state.schemas[selectedItem.ref] ||
      {}) as ActivitySchema;
    this.activitySchemaUrl = activitySchema.homepage;
    this.currentTile = mergeItemWithSchema(selectedItem, activitySchema);

    this.inputScope = getInputContext(itemId, state);
    this.isSubflowType = isSubflowTask(this.currentTile.type);
    this.title = this.currentTile.name;
    this.isValidTaskName = true;
    this.ismapperActivity = false;
    this.isTaskDetailEdited = false;
    const isSubflowItem = (item: Item): item is ItemSubflow => isSubflowTask(item.type);
    this.isSubflowType = isSubflowItem(selectedItem);
    let subflowSchema = null;
    if (isSubflowItem(selectedItem)) {
      subflowSchema = state.linkedSubflows[selectedItem.settings.flowPath];
      if (subflowSchema) {
        this.appId = state.appId;
        this.actionId = state.id;
        this.createSubflowConfig(subflowSchema);
      } else {
        return this.notificationsService.error({
          key: 'SUBFLOW:REFERENCE-ERROR-TEXT',
        });
      }
    }

    const flowMetadata = getFlowMetadata(state);
    const { propsToMap, mappings } = this.getInputMappingsInfo({
      selectedItem,
      activitySchema,
      subflowSchema,
      flowMetadata,
    });
    this.resetInputMappingsController(propsToMap, this.inputScope, mappings);
    this.initIterator(selectedItem);

    this.resetState();
    if (isMapperActivity(activitySchema)) {
      this.configureOutputMapperLabels();
      this.ismapperActivity = true;
    }

    if (this.iteratorController) {
      this.iteratorController.state$
        .pipe(takeUntil(this.contextChange$))
        .subscribe(mapperState => {
          const iterableMapping = mapperState.mappings[ITERABLE_VALUE_KEY];
          if (iterableMapping) {
            this.onIteratorValueChange(iterableMapping.expression, mapperState.isValid);
          }
        });
    }
    this.open();
  }

  private adjustIteratorInInputMapper() {
    if (this.iteratorModeOn) {
      this.enableIteratorInInputMapper();
    } else {
      this.disableIteratorInInputMapper();
    }
  }

  private enableIteratorInInputMapper() {
    const iteratorNode = this.mapperControllerFactory.createNodeFromSchema(
      getIteratorOutputSchema()
    );
    this.inputMapperController.appendOutputNode(iteratorNode);
  }

  private disableIteratorInInputMapper() {
    this.inputMapperController.removeOutputNode(ITERATOR_OUTPUT_KEY);
  }

  private initIterator(selectedItem: ItemTask) {
    const taskSettings = selectedItem.settings;
    this.canIterate = !(<ItemActivityTask>selectedItem).return;
    if (!this.canIterate) {
      this.iteratorController = null;
      return;
    }
    this.iteratorModeOn = isIterableTask(selectedItem);
    this.iterableValue =
      taskSettings && taskSettings.iterate ? taskSettings.iterate : null;
    this.initialIteratorData = {
      iteratorModeOn: this.iteratorModeOn,
      iterableValue: this.iterableValue,
    };
    const iterableValue = MapperTranslator.rawExpressionToString(
      this.iterableValue || ''
    );
    const iteratorContext = createIteratorMappingContext(iterableValue);
    this.iteratorController = this.mapperControllerFactory.createController(
      iteratorContext.inputContext,
      this.inputScope,
      iteratorContext.mappings
    );
    this.adjustIteratorInInputMapper();
  }

  private getInputMappingsInfo({
    selectedItem,
    flowMetadata,
    activitySchema,
    subflowSchema,
  }): { propsToMap: any[]; mappings: any[] } {
    let propsToMap = [];
    let mappings = [];
    const isOutputMapper = isMapperActivity(activitySchema);
    if (isOutputMapper) {
      propsToMap = flowMetadata.output;
    } else if (this.isSubflowType) {
      propsToMap = subflowSchema.metadata ? subflowSchema.metadata.input : [];
    } else if (this.currentTile.attributes && this.currentTile.attributes.inputs) {
      propsToMap = this.currentTile.attributes.inputs;
    }

    if (isOutputMapper) {
      const inputs = selectedItem.input || {};
      mappings = inputs.mappings || [];
    } else {
      mappings = this.currentTile.inputMappings;
    }
    return { mappings, propsToMap };
  }

  private resetInputMappingsController(propsToMap, inputScope, mappings) {
    if (this.inputMapperStateSubscription && !this.inputMapperStateSubscription.closed) {
      this.inputMapperStateSubscription.unsubscribe();
    }
    this.inputMapperController = this.mapperControllerFactory.createController(
      propsToMap,
      inputScope,
      mappings
    );
    this.inputMapperStateSubscription = this.inputMapperController.status$
      .pipe(
        skip(1),
        takeUntil(this.contextChange$)
      )
      .subscribe(({ isValid, isDirty }) => {
        const inputMappingsTab = this.tabs.get(TASK_TABS.INPUT_MAPPINGS);
        inputMappingsTab.isValid = isValid;
        inputMappingsTab.isDirty = isDirty;
      });
  }

  private createSubflowConfig(subflowSchema: ActionBase) {
    this.subFlowConfig = {
      name: subflowSchema.name,
      description: subflowSchema.description,
      createdAt: subflowSchema.createdAt,
      flowPath: subflowSchema.id,
    };
  }

  private resetState() {
    if (this.tabs) {
      this.tabs.clear();
    }
    let tabsInfo = [MAPPINGS_TAB_INFO];
    this.showSubflowList = false;
    if (this.isSubflowType) {
      tabsInfo = [SUBFLOW_TAB_INFO, ...tabsInfo, ITERATOR_TAB_INFO];
      this.tabs = Tabs.create(tabsInfo);
      this.tabs.get(TASK_TABS.SUBFLOW).isSelected = true;
    } else if (this.canIterate) {
      tabsInfo = [...tabsInfo, ITERATOR_TAB_INFO];
      this.tabs = Tabs.create(tabsInfo);
      this.tabs.get(TASK_TABS.INPUT_MAPPINGS).isSelected = true;
    } else {
      this.tabs = Tabs.create(tabsInfo);
      this.tabs.get(TASK_TABS.INPUT_MAPPINGS).isSelected = true;
    }
  }

  private open() {
    this.isActive = true;
  }

  private close() {
    if (!this.contextChange$.closed) {
      this.contextChange$.emitAndComplete();
    }
    this.isActive = false;
  }

  private ensurePreviousContextCleanup() {
    if (this.contextChange$ && !this.contextChange$.isStopped) {
      this.contextChange$.emitAndComplete();
    }
  }
}

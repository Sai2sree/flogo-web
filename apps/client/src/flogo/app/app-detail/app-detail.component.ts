import { sortBy, snakeCase } from 'lodash';
import { differenceInSeconds } from 'date-fns';

import {
  Component,
  Input,
  Output,
  SimpleChanges,
  OnChanges,
  OnInit,
  EventEmitter,
} from '@angular/core';
import { Observable, of as observableOf } from 'rxjs';
import { switchMap, map, take, tap, filter } from 'rxjs/operators';

import {
  LanguageService,
  FlowSummary,
  Trigger,
  ERROR_CODE,
  CONTRIB_REF_PLACEHOLDER,
} from '@flogo-web/client-core';
import { LocalStorageService, SanitizeService } from '@flogo-web/client-core/services';
import { ShimTriggerBuildApiService } from '@flogo-web/client-core/services/restapi/v2/shim-trigger-build-api.service';
import { ModalService } from '@flogo-web/client-core/modal';
import {
  ConfirmationResult,
  ConfirmationModalService,
} from '@flogo-web/client-core/confirmation';
import { NotificationsService } from '@flogo-web/client-core/notifications';
import { RESTAPIContributionsService } from '@flogo-web/client-core/services/restapi/v2/contributions.service';
import {
  AppDetailService,
  ApplicationDetail,
  ApplicationDetailState,
  FlowGroup,
  App,
  TriggerGroup,
  SETTING_DONT_WARN_MISSING_TRIGGERS,
} from '../core';
import { FlogoNewFlowComponent, NewFlowData } from '../new-flow/new-flow.component';
import {
  ExportFlowsData,
  FlogoExportFlowsComponent,
} from '../export-flows/export-flows.component';
import {
  ShimTriggerData,
  TriggerShimBuildComponent,
} from '../shim-trigger/shim-trigger.component';

import {
  MissingTriggerConfirmationComponent,
  ConfirmationResult as MissingTriggerConfirmationResult,
  ConfirmationParams,
} from '../missing-trigger-confirmation';

const MAX_SECONDS_TO_ASK_APP_NAME = 5;

@Component({
  selector: 'flogo-apps-details-application',
  templateUrl: 'app-detail.component.html',
  styleUrls: ['app-detail.component.less'],
})
export class FlogoApplicationDetailComponent implements OnChanges, OnInit {
  @Input() appDetail: ApplicationDetail;

  @Output() flowSelected: EventEmitter<FlowSummary> = new EventEmitter<FlowSummary>();
  @Output() flowAdded: EventEmitter<{
    name: string;
    description?: string;
    triggerId?: string;
  }> = new EventEmitter<FlowSummary>();
  @Output() flowDeleted: EventEmitter<App> = new EventEmitter<App>();

  application: App;
  state: ApplicationDetailState;

  isNameInEditMode: boolean;
  autofocusName = true;
  editableName: string;

  isDescriptionInEditMode: boolean;
  editableDescription: string;

  flowGroups: Array<FlowGroup> = [];
  triggerGroups: Array<TriggerGroup> = [];
  flows: Array<FlowSummary> = [];
  isFlowsViewActive: boolean;
  selectedViewTranslateKey: string;
  isNewApp = false;
  isBuildBoxShown = false;
  isBuilding: boolean;
  isViewsDropdownShown = false;
  isDetailsMenuOpen = false;

  buildOptions = [
    { label: 'Darwin/amd64', os: 'darwin', arch: 'amd64' },
    { label: 'Linux/amd64', os: 'linux', arch: 'amd64' },
    { label: 'Linux/386', os: 'linux', arch: '386' },
    { label: 'Linux/arm', os: 'linux', arch: 'arm' },
    { label: 'Linux/arm64', os: 'linux', arch: 'arm64' },
    { label: 'Windows/amd64', os: 'windows', arch: 'amd64' },
  ];

  shimTriggerOptions = [];
  shimTriggersList = [];
  isExportBoxShown = false;
  downloadLink: string;

  constructor(
    public translate: LanguageService,
    private appDetailService: AppDetailService,
    private confirmationModalService: ConfirmationModalService,
    private sanitizer: SanitizeService,
    private contributionService: RESTAPIContributionsService,
    private shimTriggersApiService: ShimTriggerBuildApiService,
    private notificationsService: NotificationsService,
    private modalService: ModalService,
    private localStorage: LocalStorageService
  ) {}

  ngOnInit() {
    this.isDescriptionInEditMode = false;
    this.isNameInEditMode = false;
    this.isFlowsViewActive = true;
    this.selectedViewTranslateKey = 'DETAILS-VIEW-MENU:FLOWS';
  }

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['appDetail'];
    if (change.currentValue) {
      this.application = this.appDetail.app;
      this.state = this.appDetail.state;
      this.downloadLink = this.appDetailService.getDownloadLink(this.application.id);
      // this.flows = this.extractFlows();
      this.createFlowGroups();
      this.createTriggerGroups();
      this.shimTriggerOptions = [];
      this.getShimTriggerBuildOptions();
      const prevValue = change.previousValue;
      const isDifferentApp =
        !prevValue || !prevValue.app || prevValue.app.id !== this.application.id;
      if (isDifferentApp) {
        this.appUpdated();
      } else {
        this.appDetailChanged();
      }
    }
  }

  private createFlowGroups() {
    const flowGroups = this.application ? this.application.flowGroups : null;
    this.flowGroups = flowGroups ? [...this.application.flowGroups] : [];
    this.flowGroups = sortBy(this.flowGroups, g =>
      g.trigger ? g.trigger.name.toLocaleLowerCase() : ''
    );
  }

  private createTriggerGroups() {
    const triggerGroups = this.application ? this.application.triggerGroups : null;
    this.triggerGroups = triggerGroups ? [...this.application.triggerGroups] : [];
    this.triggerGroups = sortBy(this.triggerGroups, g =>
      g.triggers ? g.flow.name.toLocaleLowerCase() : ''
    );
  }

  appExporter() {
    return () => {
      this.closeExportBox();
      return this.confirmActionWhenMissingTriggers('export')
        .toPromise()
        .then(proceed => {
          if (!proceed) {
            return null;
          }
          return this.performExportApp();
        });
    };
  }

  private performExportApp() {
    return this.appDetailService
      .toEngineSpec()
      .then(engineApp => {
        const appName = snakeCase(engineApp.name);
        return [
          {
            fileName: `${appName}.json`,
            data: engineApp,
          },
        ];
      })
      .catch(errRsp => {
        if (
          errRsp &&
          errRsp.errors &&
          errRsp.errors[0] &&
          errRsp.errors[0].code === ERROR_CODE.HAS_SUBFLOW
        ) {
          this.notificationsService.error({
            key: 'DETAILS-EXPORT:CANNOT-EXPORT',
          });
        } else {
          console.error(errRsp.errors);
          this.notificationsService.error({
            key: 'DETAILS-EXPORT:ERROR_UNKNOWN',
          });
        }
      });
  }

  openCreateFlow() {
    this.openNewFlowModal();
  }

  buildApp({ os, arch }) {
    this.closeBuildBox();
    this.confirmActionWhenMissingTriggers('build')
      .pipe(filter(Boolean))
      .subscribe(() =>
        this.handleBuildDownload(
          this.appDetailService.build(this.application.id, { os, arch })
        )
      );
  }

  buildShimTrigger(selectedTriggerDetails) {
    this.handleBuildDownload(
      this.shimTriggersApiService.buildShimTrigger(selectedTriggerDetails)
    );
  }

  openCreateFlowFromTrigger(trigger: Trigger) {
    this.openNewFlowModal(trigger.id);
  }

  private openNewFlowModal(triggerId?) {
    const newFlowData: NewFlowData = { appId: this.application.id };
    if (triggerId) {
      newFlowData.triggerId = triggerId;
    }
    return this.modalService
      .openModal<NewFlowData>(FlogoNewFlowComponent, newFlowData)
      .result.subscribe(flowAdded => {
        if (flowAdded) {
          this.flowAdded.emit(flowAdded);
        }
      });
  }

  onClickAddDescription(event) {
    this.isDescriptionInEditMode = true;
  }

  openExportFlow() {
    const flows = this.application.actions;
    return this.modalService.openModal<ExportFlowsData>(FlogoExportFlowsComponent, {
      flows,
    });
  }

  onNameSave() {
    let editableName = this.editableName || '';
    editableName = editableName.trim();
    if (!editableName) {
      return;
    }
    editableName = this.sanitizer.sanitizeHTMLInput(editableName);
    this.isNameInEditMode = false;
    this.appDetailService.update('name', editableName);
  }

  onNameCancel() {
    this.isNameInEditMode = false;
    this.appDetailService.cancelUpdate('name');
    this.editableName = this.application.name;
  }

  onDescriptionSave() {
    this.isDescriptionInEditMode = false;
    this.editableDescription = this.sanitizer.sanitizeHTMLInput(this.editableDescription);
    this.appDetailService.update('description', this.editableDescription);
  }

  onDescriptionCancel() {
    this.isDescriptionInEditMode = false;
    this.appDetailService.cancelUpdate('description');
    this.editableDescription = this.application.description;
  }

  onClickLabelDescription() {
    this.isDescriptionInEditMode = true;
  }

  onClickLabelName() {
    this.isNameInEditMode = true;
  }

  onFlowSelected(flow) {
    this.flowSelected.emit(flow);
  }

  onFlowDelete(eventData) {
    this.flowDeleted.emit(eventData);
  }

  onFlowAdd(newFlow) {
    this.flowAdded.emit(newFlow);
  }

  onDeleteApp(application) {
    this.closeDetailsMenu();
    this.translate
      .get(['APP-DETAIL:CONFIRM_DELETE', 'MODAL:CONFIRM-DELETION'], {
        appName: application.name,
      })
      .pipe(
        switchMap(translation => {
          return this.confirmationModalService.openModal({
            title: translation['MODAL:CONFIRM-DELETION'],
            textMessage: translation['APP-DETAIL:CONFIRM_DELETE'],
          }).result;
        })
      )
      .subscribe(result => {
        if (result === ConfirmationResult.Confirm) {
          this.appDetailService.deleteApp();
        }
      });
  }

  toggleBuildBox() {
    this.isBuildBoxShown = !this.isBuildBoxShown;
  }

  closeBuildBox() {
    this.isBuildBoxShown = false;
  }

  showShimTriggerList(ref) {
    this.shimTriggersList = this.flowGroups.filter(
      flowGroup => flowGroup.trigger && flowGroup.trigger.ref === ref
    );
    if (
      ref === CONTRIB_REF_PLACEHOLDER.REF_LAMBDA &&
      this.shimTriggersList.length === 1
    ) {
      this.buildShimTrigger({ triggerId: this.shimTriggersList[0].trigger.id });
    } else {
      this.modalService
        .openModal<ShimTriggerData>(TriggerShimBuildComponent, {
          shimTriggersList: this.shimTriggersList,
          buildOptions: this.buildOptions,
        })
        .result.subscribe(buildParams => {
          if (buildParams) {
            this.buildShimTrigger(buildParams);
          }
        });
    }
    this.closeBuildBox();
  }

  toggleExportBox() {
    this.isExportBoxShown = !this.isExportBoxShown;
  }

  closeExportBox() {
    this.isExportBoxShown = false;
  }

  toggleViewsDropdown() {
    this.isViewsDropdownShown = !this.isViewsDropdownShown;
  }

  closeViewsDropdown() {
    this.isViewsDropdownShown = false;
  }
  showDetailsView(viewType: string) {
    this.isFlowsViewActive = viewType === 'flows';
    this.selectedViewTranslateKey = this.isFlowsViewActive
      ? 'DETAILS-VIEW-MENU:FLOWS'
      : 'DETAILS-VIEW-MENU:TRIGGERS';
    this.isViewsDropdownShown = false;
  }

  toggleDetailsMenu() {
    this.isDetailsMenuOpen = !this.isDetailsMenuOpen;
  }

  closeDetailsMenu() {
    this.isDetailsMenuOpen = false;
  }

  private confirmActionWhenMissingTriggers(
    exportType: 'export' | 'build'
  ): Observable<boolean> {
    const appHasTriggers = app =>
      app &&
      app.flowGroups &&
      app.flowGroups.length > 0 &&
      app.flowGroups.some(g => !!g.trigger);
    if (
      this.localStorage.getItem(SETTING_DONT_WARN_MISSING_TRIGGERS) ||
      appHasTriggers(this.appDetail.app)
    ) {
      return observableOf(true);
    }
    return this.modalService
      .openModal<ConfirmationParams>(MissingTriggerConfirmationComponent, {
        type: exportType,
      })
      .result.pipe(
        take(1),
        tap((result: MissingTriggerConfirmationResult) => {
          if (result && result.dontShowAgain) {
            this.localStorage.setItem(SETTING_DONT_WARN_MISSING_TRIGGERS, 'true');
          }
        }),
        map(result => result && result.confirm)
      );
  }

  private handleBuildDownload(download: Observable<any>) {
    const restoreBuildFlag = () => (this.isBuilding = false);
    const handleBuildError = () => {
      this.notificationsService.error({ key: 'DETAILS:BUILD-ERROR' });
      restoreBuildFlag();
    };

    this.isBuilding = true;
    download.subscribe(restoreBuildFlag, handleBuildError);
  }

  private appUpdated() {
    this.isDescriptionInEditMode = false;

    this.editableName = this.application.name;
    this.editableDescription = this.application.description;

    this.isNameInEditMode = false;
    this.isNewApp = !this.application.updatedAt;
    if (this.isNewApp) {
      const secondsSinceCreation = differenceInSeconds(
        Date.now(),
        this.application.createdAt
      );
      this.isNewApp = secondsSinceCreation <= MAX_SECONDS_TO_ASK_APP_NAME;
      this.isNameInEditMode = this.isNewApp;
    }
  }

  private appDetailChanged() {
    if (this.state.name.hasErrors) {
      this.isNameInEditMode = true;
      this.autofocusName = false;
      setTimeout(() => (this.autofocusName = true), 100);
    } else if (!this.state.name.pendingSave) {
      this.editableName = this.application.name;
    }
  }

  private getShimTriggerBuildOptions() {
    const flowGroupsMap = this.flowGroups.map(flowGroup => {
      return {
        triggerRef: flowGroup.trigger ? flowGroup.trigger.ref : null,
      };
    });
    this.contributionService
      .getShimContributionDetails()
      .then(shimmableTriggersDetails => {
        shimmableTriggersDetails.forEach(shimmableTriggerDetail => {
          const shimmableTrigger = flowGroupsMap.find(
            flowGroupMap => flowGroupMap.triggerRef === shimmableTriggerDetail.ref
          );
          if (!!shimmableTrigger) {
            switch (shimmableTriggerDetail.ref) {
              case CONTRIB_REF_PLACEHOLDER.REF_LAMBDA:
                this.shimTriggerOptions.push({
                  label: this.translate.instant('TRIGGER-SHIM:SERVERLESS-APP'),
                  ref: shimmableTriggerDetail.ref,
                });
                break;
              case CONTRIB_REF_PLACEHOLDER.REF_CLI:
                this.shimTriggerOptions.push({
                  label: this.translate.instant('TRIGGER-SHIM:CLI-APP'),
                  ref: shimmableTriggerDetail.ref,
                });
                break;
              default:
                this.shimTriggerOptions.push({
                  label: shimmableTriggerDetail.name,
                  ref: shimmableTriggerDetail.ref,
                });
                break;
            }
          }
        });
      });
  }
}

import { FormsModule } from '@angular/forms';
import { BsModalModule } from 'ng2-bs3-modal';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { ModalService } from '@flogo-web/client-core/modal';
import { SharedModule as FlogoSharedModule } from '@flogo-web/client-shared';

import { FlogoApplicationComponent } from './app.component';
import { FlogoApplicationDetailComponent } from './app-detail/app-detail.component';
import { AppDetailService } from './core/apps.service';
import { FlogoApplicationFlowsComponent } from './shared/flows/flows.component';
import { FlowGroupComponent } from './flow-group/flow-group.component';
import { FlogoExportFlowsComponent } from './export-flows/export-flows.component';
import { FlowTriggerGroupComponent } from './trigger-group/trigger-group.component';
import { FlogoNewFlowComponent } from './new-flow/new-flow.component';
import { TriggerShimBuildComponent } from './shim-trigger/shim-trigger.component';
import { AppRoutingModule } from './app-routing.module';
import { MissingTriggerConfirmationComponent } from './missing-trigger-confirmation';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    BsModalModule,
    FlogoSharedModule,
    RouterModule,
    AppRoutingModule,
    OverlayModule,
    PortalModule,
    ScrollingModule,
  ],
  declarations: [
    FlogoApplicationDetailComponent,
    FlogoApplicationComponent,
    FlogoApplicationFlowsComponent,
    FlowGroupComponent,
    FlogoExportFlowsComponent,
    FlowTriggerGroupComponent,
    FlogoNewFlowComponent,
    TriggerShimBuildComponent,
    MissingTriggerConfirmationComponent,
  ],
  bootstrap: [],
  providers: [AppDetailService, ModalService],
  entryComponents: [
    FlogoExportFlowsComponent,
    TriggerShimBuildComponent,
    FlogoNewFlowComponent,
    MissingTriggerConfirmationComponent,
  ],
})
export class FlogoApplicationModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

import { SharedModule as FlogoSharedModule } from '@flogo-web/client-shared';
import { LogsModule as FlogoLogsModule } from '@flogo-web/client/logs';
import { DiagramModule } from '@flogo-web/client/packages/diagram';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { MonacoEditorModule } from './shared/monaco-editor';
import { FormBuilderModule as FlogoCommonFormBuilderModule } from './shared/dynamic-form';
import { FlogoRunFlowComponent } from './run-flow/run-flow.component';

import { CoreModule as FlowCoreModule } from './core';

import { TriggersModule as FlogoFlowTriggersModule } from '@flogo-web/client/flow/triggers';
import { TaskMapperModule as FlogoTaskMapperModule } from './task-configurator';
import { BranchMapperModule } from './branch-configurator';
import { ParamsSchemaModule } from './params-schema';

import { FlowRoutingModule } from './flow-routing.module';
import { FlowComponent } from './flow.component';
import { FlowDataResolver } from './flow-data.resolver';
import { featureReducer } from './core/state';

import { FlogoFlowDiagramComponent } from './flow-diagram/flow-diagram.component';
import { FlowTabsComponent } from './flow-tabs/flow-tabs.component';
import { SaveEffects } from './core/effects';

import { DebugPanelModule } from './debug-panel';
import { TaskAddModule } from './task-add';

@NgModule({
  imports: [
    CommonModule,
    ScrollingModule,
    StoreModule.forFeature('flow', featureReducer),
    EffectsModule.forFeature([SaveEffects]),
    FlogoSharedModule,
    FlogoLogsModule,
    DiagramModule,
    MonacoEditorModule.forRoot(),

    FlowCoreModule,
    ParamsSchemaModule,
    FlogoTaskMapperModule,
    FlogoCommonFormBuilderModule,
    FlogoFlowTriggersModule,
    FlowRoutingModule,
    TaskAddModule,
    DebugPanelModule,
    BranchMapperModule,
  ],
  declarations: [
    FlogoRunFlowComponent,
    FlowComponent,
    FlogoFlowDiagramComponent,
    FlowTabsComponent,
  ],
  providers: [FlowDataResolver],
  bootstrap: [FlowComponent],
})
export class FlowModule {}

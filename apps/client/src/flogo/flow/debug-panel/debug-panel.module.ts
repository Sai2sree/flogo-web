import { NgModule } from '@angular/core';
import { CommonModule as NgCommonModule } from '@angular/common';
import { SharedModule } from '@flogo-web/client-shared';
import { FormBuilderModule as DynamicFormModule } from '@flogo-web/client/flow/shared/dynamic-form';

import { PanelContentComponent } from './panel-content/panel-content.component';
import { FieldsComponent } from './fields/fields.component';
import { ErrorComponent } from './error/error.component';
import { ToggleIconComponent } from './header-toggler/toggle-icon.component';
import { HeaderTogglerComponent } from './header-toggler/header-toggler.component';

import { DebugPanelComponent } from './debug-panel.component';
import { ToggleButtonComponent } from './toggle-button/toggle-button.component';
import { TogglerRefService } from './toggler-ref.service';

@NgModule({
  imports: [NgCommonModule, SharedModule, DynamicFormModule],
  declarations: [
    PanelContentComponent,
    FieldsComponent,
    ErrorComponent,
    ToggleIconComponent,
    HeaderTogglerComponent,

    ToggleButtonComponent,
    DebugPanelComponent,
  ],
  providers: [TogglerRefService],
  exports: [DebugPanelComponent, ToggleButtonComponent],
})
export class DebugPanelModule {}

import { NgModule } from '@angular/core';
import { CommonModule as NgCommonModule } from '@angular/common';

import { SharedModule as FlogoSharedModule } from '@flogo-web/lib-client/common';

import { MapperModule } from '../shared/mapper';
import { StageConfiguratorComponent } from './stage-configurator.component';

@NgModule({
  imports: [
    // module dependencies
    NgCommonModule,
    FlogoSharedModule,
    MapperModule,
  ],
  declarations: [StageConfiguratorComponent],
  exports: [StageConfiguratorComponent],
  providers: [],
})
export class StageConfiguratorModule {}

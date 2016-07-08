import {Component} from '@angular/core';

import {FlogoFormBuilderFieldsRadio as FieldRadio} from '../../flogo.form-builder.fields/components/fields.radio/fields.radio.component';
import {FlogoFormBuilderFieldsTextBox as FieldTextBox} from '../../flogo.form-builder.fields/components/fields.textbox/fields.textbox.component';
import {FlogoFormBuilderFieldsParams as FieldParams} from '../../flogo.form-builder.fields/components/fields.params/fields.params.component';
import {FlogoFormBuilderFieldsTextArea as FieldTextArea} from '../../flogo.form-builder.fields/components/fields.textarea/fields.textarea.component';
import {FlogoFormBuilderFieldsNumber as FieldNumber} from '../../flogo.form-builder.fields/components/fields.number/fields.number.component';
import {FlogoFormBuilderCommon} from '../../flogo.form-builder/form-builder.common';

@Component({
    selector: 'flogo-form-builder-branch-configuration',
    moduleId: module.id,
    templateUrl: 'form-builder.configuration.branch.tpl.html',
    directives: [FieldRadio, FieldTextBox, FieldParams, FieldTextArea, FieldNumber],
    inputs: ['_fieldObserver:fieldObserver','_attributes:attributes'],
    providers: [FlogoFormBuilderCommon]
})
export class FlogoFormBuilderConfigurationBranchComponent {
  _fieldObserver : any;
  _attributes: any;
  fields:any;

  constructor(private _commonService: FlogoFormBuilderCommon) {
  }

  ngOnInit() {
    this.fields =  this._attributes;
  }


  getBranchInfo( branchInfo : any ) {
    var info = {
      name:       'condition',
      id:         branchInfo.id,
      title:      'If',
      value:      branchInfo.condition,
      required:   true,
      placeholder: '',
      isBranch:   true,
      isTrigger: false,
      isTask: false
    };

    return info;
  }



}
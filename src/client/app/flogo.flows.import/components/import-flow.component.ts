import { Component, ElementRef, EventEmitter } from '@angular/core';
import { RESTAPIFlowsService } from '../../../common/services/restapi/flows-api.service';
import { notification } from '../../../common/utils';

@Component( {
  selector : 'flogo-flows-import',
  moduleId : module.id,
  templateUrl : 'import-flow.tpl.html',
  styleUrls : [ 'import-flow.component.css' ],
  outputs : [ 'onError:importError', 'onSuccess:importSuccess' ]
} )
export class FlogoFlowsImport {
  private _elmRef : ElementRef;
  private onError : EventEmitter<any>;
  private onSuccess : EventEmitter<any>;

  constructor( elementRef : ElementRef, private _flowsAPIs : RESTAPIFlowsService ) {
    this._elmRef = elementRef;
    this.onError = new EventEmitter<any>();
    this.onSuccess = new EventEmitter<any>();
  }

  private selectFile( evt : any ) {
    let fileElm = jQuery( this._elmRef.nativeElement )
      .find( '.flogo-flows-import-input-file' );

    // clean the previous selected file
    try {
      fileElm.val( '' );
    } catch ( err ) {
      console.error( err );
    }

    // trigger the file input.
    // fileElm.click();
  }

  getErrorMessageActivitiesNotInstalled(errors) {
    let errorMessage = '';
    let details = errors.details;
    let errorTriggers = '';
    let errorActivities = '';

    if(details.triggers.length) {
      errorTriggers = ` Trigger: "${details.triggers.join(',')}"`;
    }

    if(details.activities.length) {
      if(errorTriggers) {
        errorActivities += ",";
      }
      errorActivities += `Activities: "${details.activities.join(',')}"`;
    }
    errorMessage = `Flow could not be imported, some triggers/activities are not installed.${errorTriggers} ${errorActivities}`;

    return errorMessage;
  }

  private onFileChange( evt : any ) {
    let importFile = <File> _.get( evt, 'target.files[0]' );

    if ( _.isUndefined( importFile ) ) {
      console.error( 'Invalid file to import' );
    } else {
      this._flowsAPIs.importFlow( importFile )
        .then( ( result : any )=> {
          this.onSuccess.emit( result );
        } )
        .catch( ( err : any )=> {
          let objError;
          try {
            objError = JSON.parse(err.response);
          }catch(exc) {
            objError = {};
          }

          if(objError.type == 1) {
            let errorMessage = this.getErrorMessageActivitiesNotInstalled(objError);
            this.onError.emit( {response: errorMessage} );
          } else {
            this.onError.emit( err );
          }
        } );
    }
  }
}

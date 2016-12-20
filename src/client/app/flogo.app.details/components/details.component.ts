import { Component, OnChanges, AfterViewInit, ViewChild, ElementRef, Renderer } from '@angular/core';
import { CanActivate,  RouteParams } from '@angular/router-deprecated';
import { isConfigurationLoaded } from '../../../common/services/configurationLoaded.service';
import { TranslatePipe, TranslateService } from 'ng2-translate/ng2-translate';
import { IFlogoApplicationModel } from '../../../common/application.model';
import { timeString } from '../../../common/utils';

import {
    notification,
} from '../../../common/utils';

import { Contenteditable, JsonDownloader } from '../../../common/directives';
import { FlogoModal } from '../../../common/services/modal.service';


@Component( {
    selector: 'flogo-app-details',
    moduleId: module.id,
    directives: [ Contenteditable ],
    templateUrl: 'details.tpl.html',
    styleUrls: [ 'details.component.css' ],
    providers: [ FlogoModal ],
    pipes: [TranslatePipe]
} )
@CanActivate((next) => {
    return isConfigurationLoaded();
})



export class FlogoApplicationDetailsComponent implements AfterViewInit  {
    @ViewChild('appName') appName: ElementRef;
    application: IFlogoApplicationModel = null;
    createdAtFormatted: any;

    constructor(
        private _flogoModal: FlogoModal,
        private _routeParams: RouteParams,
        public translate: TranslateService,
        private renderer: Renderer
    ) {
        this.application = this._routeParams.params['application'] as IFlogoApplicationModel;

        // format create at
        let timeStr = timeString(this.application.createdAt);
        this.createdAtFormatted = moment(timeStr, 'YYYYMMDD hh:mm:ss').fromNow();
    }

    ngAfterViewInit() {
        this.renderer.invokeElementMethod(this.appName.nativeElement, 'focus',[]);
    }

}

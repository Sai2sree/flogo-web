import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  ViewChild,
} from '@angular/core';
import { BsModalComponent } from 'ng2-bs3-modal';

import { ValidationDetail } from '@flogo-web/client-core';

import { ImportErrorFormatterService } from '../core/import-error-formatter.service';

@Component({
  selector: 'flogo-home-app-import',
  templateUrl: 'app-import.component.html',
  styleUrls: ['app-import.component.less'],
})
export class FlogoAppImportComponent implements OnChanges, AfterViewInit {
  @ViewChild('errorModal') modal: BsModalComponent;

  @Input() importValidationErrors: ValidationDetail[];
  @Output() modalClose: EventEmitter<boolean> = new EventEmitter<boolean>();

  errorDetails: ValidationDetail[];

  constructor(public errorFormatter: ImportErrorFormatterService) {
    this.errorDetails = [];
  }

  ngOnChanges(changes: any) {
    this.errorDetails = this.errorFormatter.getErrorsDetails(this.importValidationErrors);
  }

  ngAfterViewInit() {
    this.openModal();
  }

  openModal() {
    this.modal.open();
  }

  onModalCloseOrDismiss() {
    this.modalClose.emit(false);
  }

  closeModal() {
    this.modal.close();
    this.onModalCloseOrDismiss();
  }
}

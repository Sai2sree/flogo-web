import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChange,
  ViewChild,
} from '@angular/core';
import { BsModalComponent } from 'ng2-bs3-modal';

@Component({
  selector: 'flogo-walkthrough',
  templateUrl: 'walkthrough.component.html',
  styleUrls: ['walkthrough.component.less'],
})
export class WalkthroughComponent implements OnChanges {
  @ViewChild('instructionsModal') modal: BsModalComponent;

  @Input()
  isActivated: boolean;
  @Output()
  closedModal = new EventEmitter();
  steps = [
    {
      title: 'Configure the trigger',
      description: '',
      screenshot: 'flogo.instructions.screen-1@3x.png',
    },
    {
      title: 'Add and configure activities',
      description: '',
      screenshot: 'flogo.instructions.screen-2@3x.png',
    },
    {
      title: 'Run and test at any time',
      description: '',
      screenshot: 'flogo.instructions.screen-3@3x.png',
    },
    {
      title: 'Build and run',
      description: '',
      screenshot: 'flogo.instructions.screen-4@3x.png',
    },
  ];
  currentIndex: number;
  currentStep: any;
  STEPS_LENGTH = this.steps.length - 1;

  constructor() {
    this.init();
  }

  init() {
    this.currentIndex = 0;
    this.currentStep = this.steps[this.currentIndex];
  }

  clickOption(step: any, index: number) {
    this.currentStep = step;
    this.currentIndex = index;
  }

  clickNext(event) {
    if (this.currentIndex < this.STEPS_LENGTH) {
      this.currentIndex += 1;
    }
    this.currentStep = this.steps[this.currentIndex];
  }

  clickBack(event) {
    if (this.currentIndex > 0) {
      this.currentIndex -= 1;
    }
    this.currentStep = this.steps[this.currentIndex];
  }

  ngOnChanges(changes: { isActivated?: SimpleChange }) {
    if (changes.isActivated && changes.isActivated.currentValue) {
      this.openModal();
    }
  }

  openModal() {
    this.init();
    this.modal.open('lg');
  }

  closeModal() {
    this.modal.close();
    this.closedModal.emit(true);
  }

  onModalCloseOrDismiss(event) {
    this.closedModal.emit(true);
  }

  onInstallAction(url: string) {}
}

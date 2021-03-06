import {
  Component,
  EventEmitter,
  Input,
  Output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { StreamSimulation } from '@flogo-web/core';

@Component({
  selector: 'flogo-stream-run-action-status',
  templateUrl: './action-status.component.html',
  styleUrls: ['./action-status.component.less'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionStatusComponent {
  readonly statuses = StreamSimulation.ProcessStatus;
  @Input() status: StreamSimulation.ProcessStatus;
  @Input() disabled = false;
  @Input() disableRunStream: boolean;
  @Output() run = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() resume = new EventEmitter<void>();
  @Output() stop = new EventEmitter<void>();
}

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Checklist, Flow } from '../../../app/interface/checklist.interface';
import { ChecklistIconComponent } from '../../icons/checklist-icon/checklist-icon.component';

@Component({
  selector: 'app-checklist-flow',
  imports: [ChecklistIconComponent],
  templateUrl: './checklist-flow.component.html',
  styleUrl: './checklist-flow.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistFlowComponent {
  @Input({ required: true }) flow!: Flow;
  @Input({ required: true }) records: Checklist[] = [];
  @Input({ required: true }) currentId = '';
  @Output() openRecord = new EventEmitter<string>();

  protected record(templateId: string) {
    return this.records.find((item) => item.flowId === this.flow.id && item.templateId === templateId);
  }

  protected state(templateId: string): string {
    const record = this.record(templateId);

    if (record?.id === this.currentId) return 'current';
    if (record?.status === 'Finalizado') return 'done';
    if (record) return 'generated';

    return 'future';
  }
}

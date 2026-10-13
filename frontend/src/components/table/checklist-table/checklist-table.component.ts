import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TooltipDirective } from '@coreui/angular';
import { IColumn, ISorterValue, SmartTableComponent, TemplateIdDirective } from '@coreui/angular-pro';
import { ChecklistTableRow, Status } from '../../../app/interface/checklist.interface';
import { ChecklistIconComponent } from '../../icons/checklist-icon/checklist-icon.component';

@Component({
  selector: 'app-checklist-table',
  imports: [CommonModule, FormsModule, SmartTableComponent, TemplateIdDirective, TooltipDirective, ChecklistIconComponent],
  templateUrl: './checklist-table.component.html',
  styleUrl: './checklist-table.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ChecklistTableComponent {
  @Input() data: ChecklistTableRow[] = [];
  @Input() loading = false;
  @Input() searchValue = '';
  @Input() selectedStatus = '';
  @Input() sorterValue: { column?: string; state?: 'asc' | 'desc' } = {};
  @Output() openRecord = new EventEmitter<string>();
  @Output() sorterChange = new EventEmitter<ISorterValue>();
  @Output() itemsPerPageChange = new EventEmitter<number>();
  @Output() filterChange = new EventEmitter<string>();
  @Output() statusChange = new EventEmitter<string>();
  @Output() clearAll = new EventEmitter<void>();

  protected readonly statuses: Status[] = ['Rascunho', 'Em andamento', 'Pendente', 'Finalizado', 'Cancelado'];
  protected readonly columns: IColumn[] = [
    this.column('number', '#'),
    this.column('title', 'Título'),
    this.column('category', 'Categoria'),
    this.column('model', 'Modelo'),
    this.column('status', 'Status'),
    this.column('updated', 'Última modificação'),
  ];

  protected open(event: { item: ChecklistTableRow }): void {
    this.openRecord.emit(event.item.id);
  }

  protected onFilterValueChange(value: string): void {
    if (value !== this.searchValue) this.filterChange.emit(value);
  }

  protected onSorterValueChange(value: ISorterValue): void {
    if (value?.column !== this.sorterValue.column || value?.state !== this.sorterValue.state) this.sorterChange.emit(value);
  }

  protected badgeClass(status: Status): string {
    return status === 'Finalizado' ? 'complete' : status === 'Pendente' ? 'pending' : status === 'Cancelado' ? 'canceled' : status === 'Em andamento' ? 'in-progress' : 'draft';
  }

  private column(key: string, label: string): IColumn {
    return {
      key,
      label,
      _labelTemplateId: 'all',
      _style: { backgroundColor: 'rgba(var(--cui-emphasis-color-rgb), 0.04)', whiteSpace: 'nowrap' },
      sorter: () => 0,
      filter: false,
    };
  }
}

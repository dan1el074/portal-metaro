import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective, FormControlDirective } from '@coreui/angular';
import { IColumn, ISorterValue, SmartPaginationComponent, SmartTableComponent, TemplateIdDirective } from '@coreui/angular-pro';
import { SerialPlate, SerialPlateSelection } from '../../../app/interface/serial-plates.interface';
import { SERIAL_PLATES_PAGE_SIZES, STATUSES } from '../../../app/config/serial-plates.config';
import { ChecklistIconComponent } from '../../icons/checklist-icon/checklist-icon.component';

@Component({
  selector: 'app-serial-plates-table',
  imports: [
    CommonModule,
    FormsModule,
    ButtonDirective,
    FormControlDirective,
    SmartPaginationComponent,
    SmartTableComponent,
    TemplateIdDirective,
    ChecklistIconComponent
  ],
  templateUrl: './serial-plates-table.component.html',
  styleUrl: './serial-plates-table.component.scss'
})
export class SerialPlatesTableComponent implements OnChanges {
  @Input() public data: SerialPlate[] = [];
  @Input() public selected = new Set<string>();
  @Input() public search = '';
  @Input() public canEdit = false;
  @Input() public page = 1;
  @Input() public pages = 1;
  @Input() public perPage = 10;
  @Input() public sorter: ISorterValue = { column: 'serial', state: 'desc' };
  @Output() public searchChange = new EventEmitter<string>();
  @Output() public clearFiltersRequest = new EventEmitter<void>();
  @Output() public clearSelection = new EventEmitter<void>();
  @Output() public batchRequest = new EventEmitter<void>();
  @Output() public reportRequest = new EventEmitter<void>();
  @Output() public recordOpen = new EventEmitter<SerialPlate>();
  @Output() public selectionChange = new EventEmitter<SerialPlateSelection>();
  @Output() public selectAllChange = new EventEmitter<boolean>();
  @Output() public sorterChange = new EventEmitter<ISorterValue>();
  @Output() public pageChange = new EventEmitter<number>();
  @Output() public perPageChange = new EventEmitter<number>();

  public readonly pageSizes = SERIAL_PLATES_PAGE_SIZES;
  public displayRows: SerialPlate[] = [];
  public allSelected = false;
  public someSelected = false;
  public readonly columns: IColumn[] = [
    { key: 'selection', label: '', sorter: false, filter: false, _labelTemplateId: 'selection', _style: { width: '48px', padding: '12px 16px', backgroundColor: 'rgba(var(--cui-emphasis-color-rgb), .04)' } },
    ...[['serial', 'Nº Série'], ['of', 'OF'], ['order', 'Nº Pedido'], ['client', 'Cliente'], ['description', 'Modelo'], ['provider', 'Terceiro'], ['status', 'Status'], ['updated', 'Modificado']].map(([key, label]) => ({ key, label, filter: false, sorter: () => 0, _labelTemplateId: 'all', _style: { backgroundColor: 'rgba(var(--cui-emphasis-color-rgb), .04)', whiteSpace: 'nowrap' } }))
  ];

  public ngOnChanges(): void {
    // CoreUI reverses custom sorting in descending mode; compensate only its page input.
    this.displayRows = this.sorter.state === 'desc' ? [...this.data].reverse() : this.data;
    this.allSelected = this.data.length > 0 && this.data.every(row => this.selected.has(row.serial));
    this.someSelected = !this.allSelected && this.data.some(row => this.selected.has(row.serial));
  }

  public onHeaderSelectionClick(event: MouseEvent): void {
    if (!(event.target instanceof Element))
      return;
    const checkbox = event.target.closest('th')?.querySelector('.select-all-checkbox');
    if (!checkbox || event.target === checkbox)
      return;
    event.preventDefault();
    this.selectAllChange.emit(!this.allSelected);
  }

  public onCellClick(column: string, item: SerialPlate, event: MouseEvent): void {
    if (column !== 'selection')
      return;
    event.stopPropagation();
    this.selectionChange.emit({ serial: item.serial, event });
  }

  public onRowClick(event: { item: SerialPlate; columnName?: string; event?: MouseEvent; }): void {
    if (event.columnName === 'selection' || (event.event?.target as HTMLElement | null)?.closest('input')) return;
    this.recordOpen.emit(event.item);
  }

  public serialLabel(value: string): string {
    return value.replace(/^0+(?=\d)/, '');
  }

  public numericOf(value: string): string {
    return value.replace(/\D/g, '');
  }

  public statusClass(status: string): string {
    return ['draft', 'in-progress', 'pending', 'received', 'complete'][STATUSES.indexOf(status as typeof STATUSES[number])] || 'draft';
  }
}

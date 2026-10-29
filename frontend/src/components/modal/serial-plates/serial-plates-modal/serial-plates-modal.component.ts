import { SerialPlatesService } from '../../../../app/services/serial-plates.service';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, InputGroupComponent, InputGroupTextDirective, ModalModule } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { SERIAL_PLATES_MONTHS, STATUSES } from '../../../../app/config/serial-plates.config';
import { SerialPlate, SerialPlateDialog, SerialPlateCreateDraft, SerialPlateBatchFields, PlatePatch, PlateSettings, ErpOrderItem } from '../../../../app/interface/serial-plates.interface';
import { ReportPreviewData } from '../../../../app/interface/report-preview.interface';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { ReportPreviewComponent } from '../../../report-preview/report-preview.component';

@Component({
  selector: 'app-serial-plates-modal',
  imports: [CommonModule, FormsModule, ButtonCloseDirective, ButtonDirective, FormControlDirective, InputGroupComponent, InputGroupTextDirective, ModalModule, ModalBackNavigationDirective, ChecklistIconComponent, ReportPreviewComponent],
  templateUrl: './serial-plates-modal.component.html',
  styleUrl: './serial-plates-modal.scss'
})
export class SerialPlatesModalComponent {
  @Input() public visible = false;
  @Input() public dialog: SerialPlateDialog = '';
  @Input() public title = '';
  @Input() public error = '';
  @Input() public busy = false;
  @Input() public canEdit = false;
  @Input() public createDraft!: SerialPlateCreateDraft;
  @Input() public edit: SerialPlate | null = null;
  @Input() public batch!: PlatePatch;
  @Input() public batchFields!: SerialPlateBatchFields;
  @Input() public settingsDraft!: PlateSettings;
  @Input() public providers: string[] = [];
  @Input() public batchOrderItems: ErpOrderItem[] = [];
  @Input() public selectedCount = 0;
  @Input() public report!: ReportPreviewData;
  @Input() public missing: string[] = [];
  @Output() public visibleChange = new EventEmitter<boolean>();
  @Output() public closeRequest = new EventEmitter<void>();
  @Output() public createErpRequest = new EventEmitter<void>();
  @Output() public createRequest = new EventEmitter<void>();
  @Output() public saveRequest = new EventEmitter<void>();
  @Output() public batchRequest = new EventEmitter<void>();
  @Output() public settingsRequest = new EventEmitter<void>();
  @Output() public historyRequest = new EventEmitter<void>();
  @Output() public exportRequest = new EventEmitter<void>();
  @Output() public orderChange = new EventEmitter<string>();
  @Output() public erpRequest = new EventEmitter<string | undefined>();
  @Output() public readyStockChange = new EventEmitter<boolean>();
  @Output() public batchOrderChange = new EventEmitter<string>();
  @Output() public batchErpRequest = new EventEmitter<void>();
  @Output() public batchReadyStockChange = new EventEmitter<boolean>();

  public readonly months = SERIAL_PLATES_MONTHS;
  public readonly statuses = STATUSES;

  public constructor(private readonly data: SerialPlatesService) {
  }

  public orderItems(orderNumber: string): ErpOrderItem[] {
    return this.data.orderItems(orderNumber);
  }

  public orderItemDescription(item: ErpOrderItem): string {
    if (item.orderDescription) return item.orderDescription;
    const label = item.label || item.description;
    for (const separator of [' - ', ' — ', ' – ']) {
      const suffix = separator + item.description;
      if (label.endsWith(suffix)) return label.slice(0, -suffix.length);
    }
    return label;
  }

  public serialLabel(value: string): string {
    return value.replace(/^0+(?=\d)/, '');
  }

  public batchIsReadyStock(): boolean {
    return this.batchFields.readyStock && this.batch.readyStock === true;
  }

  public manufacturingMonth(record: PlatePatch | null = this.edit): string {
    return record?.manufactured?.split('-')[1] ?? '';
  }

  public manufacturingYear(record: PlatePatch | null = this.edit): string {
    return record?.manufactured?.split('-')[0] ?? '';
  }

  public setManufacturingMonth(month: string, record: PlatePatch | null = this.edit): void {
    if (record)
      record.manufactured = `${this.manufacturingYear(record)}-${month}`;
  }

  public setManufacturingYear(year: string | number | null, record: PlatePatch | null = this.edit): void {
    if (record)
      record.manufactured = `${String(year ?? '').replace(/\D/g, '').slice(0, 4)}-${this.manufacturingMonth(record)}`;
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { Checklist, Category, Template } from '../../../../app/interface/checklist.interface';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistErpOrder, ChecklistRecordCreate, ChecklistService } from '../../../../app/services/checklist.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

@Component({
  selector: 'app-checklist-new-record-modal',
  imports: [CommonModule, FormsModule, ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective],
  templateUrl: './checklist-new-record-modal.component.html',
  styleUrl: './checklist-new-record-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistNewRecordModalComponent {
  @Output() createRecord = new EventEmitter<ChecklistRecordCreate>();

  protected visible = false;
  protected categoryId = '';
  protected templateId = '';
  protected predecessorId = '';
  protected order = '';
  protected item = '';
  protected serial = '';
  protected erpOrder?: ChecklistErpOrder;
  protected loadingOrder = false;
  protected orderError = '';

  constructor(
    protected store: ChecklistPreviewService,
    private readonly api: ChecklistService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  public open(): void {
    this.categoryId = this.availableCategories[0]?.id ?? '';
    this.selectDefaultTemplate();
    this.visible = true;
    this.cdr.detectChanges();
  }

  protected close(): void {
    this.visible = false;
    this.cdr.detectChanges();
  }

  protected categoryChanged(): void {
    this.selectDefaultTemplate();
  }

  protected templateChanged(): void {
    this.predecessorId = '';
    this.resetIdentification();
  }

  protected get category(): Category | undefined {
    return this.store.state().categories.find((item) => item.id === this.categoryId);
  }

  protected get availableCategories(): Category[] {
    return this.store.state().categories.filter((item) => item.active && this.store.canOperate(item.id) && this.templatesForCategory(item.id).length > 0);
  }

  protected get templates(): Template[] {
    return this.templatesForCategory(this.categoryId);
  }

  private templatesForCategory(categoryId: string): Template[] {
    const models = this.store.state().templates.filter((item) => item.categoryId === categoryId && !item.predecessorId);
    for (const record of this.store.state().records) {
      if (!this.store.visible(record) || record.status !== 'Finalizado' || this.store.blocked(record)) continue;
      const flow = this.store.flow(record);
      const index = flow.plan.findIndex((step) => step.template.id === record.templateId);
      const next = flow.plan.slice(index + 1).find((step) => !flow.skipped[step.template.id]);
      if (next?.category.id === categoryId && !next.template.automatic && !this.store.state().records.some((item) => item.flowId === flow.id && item.templateId === next.template.id) && !models.some((item) => item.id === next.template.id)) models.push(next.template);
    }
    return models;
  }

  protected get needsPredecessor(): boolean {
    return !!this.templates.find((item) => item.id === this.templateId)?.predecessorId;
  }

  protected get predecessors(): Checklist[] {
    return this.store.state().records.filter((record) => {
      if (!this.store.visible(record) || record.status !== 'Finalizado' || this.store.blocked(record)) return false;
      const flow = this.store.flow(record);
      const index = flow.plan.findIndex((step) => step.template.id === record.templateId);
      const next = flow.plan.slice(index + 1).find((step) => !flow.skipped[step.template.id]);
      return next?.template.id === this.templateId && !next.template.automatic && !this.store.state().records.some((item) => item.flowId === flow.id && item.templateId === this.templateId);
    });
  }

  protected get requiresErp(): boolean {
    return !this.needsPredecessor && !!this.category?.erp;
  }

  protected get requiresSerial(): boolean {
    return !this.needsPredecessor && !!this.category?.serial;
  }

  protected get canConfirm(): boolean {
    return !!this.templateId
      && (!this.needsPredecessor || !!this.predecessorId)
      && (!this.requiresErp || (!!this.erpOrder && !!this.item && String(this.erpOrder.number) === this.order.trim()))
      && (!this.requiresSerial || !!this.serial.trim())
      && !this.loadingOrder;
  }

  protected orderChanged(): void {
    if (String(this.erpOrder?.number ?? '') === this.order.trim()) return;
    this.erpOrder = undefined;
    this.item = '';
    this.orderError = '';
  }

  protected searchOrder(): void {
    const order = this.order.trim();
    if (!order || this.loadingOrder || String(this.erpOrder?.number ?? '') === order) return;
    this.loadingOrder = true;
    this.orderError = '';
    this.api.findErpOrder(order).subscribe({
      next: (result) => {
        this.erpOrder = result;
        this.item = result.items.length === 1 ? this.formatItem(result.items[0]) : '';
        this.loadingOrder = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.erpOrder = undefined;
        this.item = '';
        this.orderError = 'Pedido não encontrado no ERP.';
        this.loadingOrder = false;
        this.cdr.detectChanges();
      },
    });
  }

  protected formatItem(item: ChecklistErpOrder['items'][number]): string {
    return `${item.code} - ${item.description}`;
  }

  protected confirm(): void {
    if (!this.canConfirm) return;
    this.createRecord.emit({
      templateId: this.templateId,
      predecessorRecordId: this.predecessorId || undefined,
      serial: this.serial.trim() || undefined,
      order: this.order.trim() || undefined,
      clientId: this.erpOrder?.cnpj,
      client: this.erpOrder?.client,
      item: this.item || undefined,
      seller: this.erpOrder?.salesperson,
    });
    this.close();
  }

  private selectDefaultTemplate(): void {
    this.templateId = this.templates[0]?.id ?? '';
    this.predecessorId = '';
    this.resetIdentification();
  }

  private resetIdentification(): void {
    this.order = '';
    this.item = '';
    this.serial = '';
    this.erpOrder = undefined;
    this.loadingOrder = false;
    this.orderError = '';
  }
}

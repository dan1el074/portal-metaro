import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Output, ViewChild, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { Checklist, Category, Template } from '../../../../app/interface/checklist.interface';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistErpOrder, ChecklistRecordCreate, ChecklistService } from '../../../../app/services/checklist.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { Subscription } from 'rxjs';
import { ChecklistActionModalComponent } from '../checklist-action-modal/checklist-action-modal.component';
import { isProductionKit } from '../../../../app/shared/checklist-rules';
import { BackNavigationService } from '../../../../app/services/back-navigation.service';

@Component({
  selector: 'app-checklist-new-record-modal',
  imports: [ChecklistActionModalComponent, CommonModule, FormsModule, ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective],
  templateUrl: './checklist-new-record-modal.component.html',
  styleUrl: './checklist-new-record-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistNewRecordModalComponent implements OnDestroy {
  @ViewChild(ChecklistActionModalComponent) private actionModal!: ChecklistActionModalComponent;
  protected readyStock = false;
  protected availableSerials: Array<{ serial: string; description: string }> = [];
  protected loadingSerials = false;
  protected serialError = '';
  private serialRequest?: Subscription;
  private orderRequest?: Subscription;
  private destroyed = false;
  protected confirming = false;

  protected get production(): boolean { return this.category?.integration === 'production'; }
  protected get portalAdmin(): boolean { return this.store.user.roles.some(role => role.authority === 'ROLE_ADMIN'); }
  protected get productionKit(): boolean {
    const template = this.templates.find(item => item.id === this.templateId);
    return !!template && !!this.category && isProductionKit({ template, category: this.category, equipment: '' });
  }

  protected readyStockChanged(): void {
    this.orderRequest?.unsubscribe();
    this.loadingOrder = false;
    this.order = '';
    this.item = '';
    this.erpOrder = undefined;
    this.orderError = '';
    this.loadSerials();
  }

  protected loadSerials(): void {
    this.serialRequest?.unsubscribe();
    this.serial = '';
    this.availableSerials = [];
    this.serialError = '';
    this.loadingSerials = false;
    if (!this.production || this.predecessorId || (!this.readyStock && (!this.erpOrder || !this.item))) return;
    this.loadingSerials = true;
    this.serialRequest = this.api.availableSerials(this.readyStock ? '' : this.order.trim(), this.readyStock).subscribe({
      next: options => { this.availableSerials = options; this.loadingSerials = false; this.cdr.markForCheck(); },
      error: () => { this.serialError = 'Não foi possível consultar os números de série. Tente novamente.'; this.loadingSerials = false; this.cdr.markForCheck(); },
    });
  }

  public ngOnDestroy(): void { this.destroyed = true; this.orderRequest?.unsubscribe(); this.serialRequest?.unsubscribe(); }

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
    private readonly backNavigation: BackNavigationService,
  ) {}

  public open(): void {
    this.categoryId = this.availableCategories[0]?.id ?? '';
    this.selectDefaultTemplate();
    this.visible = true;
    this.cdr.detectChanges();
  }

  protected close(): void {
    this.visible = false;
    this.orderRequest?.unsubscribe();
    this.serialRequest?.unsubscribe();
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
    const models = this.store.state().templates.filter((item) => item.categoryId === categoryId && (!item.predecessorId || item.optionalPredecessor));
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
    const template = this.templates.find((item) => item.id === this.templateId);
    return !!template?.predecessorId && !template.optionalPredecessor;
  }

  protected get hasPredecessor(): boolean {
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
    return !this.predecessorId && !!this.category?.erp && !this.readyStock;
  }

  protected get showsSerial(): boolean {
    return !this.predecessorId && (!!this.category?.serial || this.production);
  }

  protected get requiresSerial(): boolean {
    const template = this.templates.find((item) => item.id === this.templateId);
    if (!template || !this.showsSerial) return false;
    if (this.production && this.portalAdmin) return false;
    return !isProductionKit({
      template,
      category: this.category!,
      equipment: '',
    });
  }

  protected get canConfirm(): boolean {
    return !!this.templateId
      && (!this.needsPredecessor || !!this.predecessorId)
      && (!this.requiresErp || (!!this.erpOrder && !!this.item && String(this.erpOrder.number) === this.order.trim()))
      && (!this.requiresSerial || !!this.serial.trim())
      && !this.loadingOrder && !this.loadingSerials;
  }

  protected orderChanged(): void {
    if (String(this.erpOrder?.number ?? '') === this.order.trim()) return;
    this.orderRequest?.unsubscribe();
    this.loadingOrder = false;
    this.erpOrder = undefined;
    this.item = '';
    this.orderError = '';
    this.loadSerials();
  }

  protected searchOrder(): void {
    const order = this.order.trim();
    if (!order || this.loadingOrder || String(this.erpOrder?.number ?? '') === order) return;
    this.loadingOrder = true;
    this.orderError = '';
    this.orderRequest?.unsubscribe();
    this.orderRequest = this.api.findErpOrder(order).subscribe({
      next: (result) => {
        this.erpOrder = result;
        this.item = result.items.length === 1 ? this.formatItem(result.items[0]) : '';
        this.loadingOrder = false;
        this.loadSerials();
        this.cdr.detectChanges();
      },
      error: () => {
        this.erpOrder = undefined;
        this.item = '';
        this.orderError = 'Pedido não encontrado no ERP.';
        this.loadingOrder = false;
        this.loadSerials();
        this.cdr.detectChanges();
      },
    });
  }

  protected formatItem(item: ChecklistErpOrder['items'][number]): string {
    return `${item.code} - ${item.description}`;
  }

  protected async confirm(): Promise<void> {
    if (!this.canConfirm || this.confirming) return;
    const withoutSerial = this.production && !this.predecessorId && !this.productionKit && !this.serial.trim();
    this.confirming = true;
    try {
      if (withoutSerial && (!this.portalAdmin || !await this.requestSerialWaiver())) return;
      if (this.destroyed) return;
      this.createRecord.emit({
        readyStock: this.production && this.readyStock,
        confirmWithoutSerial: withoutSerial,
        templateId: this.templateId,
        predecessorRecordId: this.predecessorId || undefined,
        serial: this.serial.trim() || undefined,
        order: this.readyStock ? undefined : this.order.trim() || undefined,
        clientId: this.erpOrder?.cnpj,
        client: this.erpOrder?.client,
        item: this.item || undefined,
        seller: this.erpOrder?.salesperson,
      });
      this.close();
    } finally {
      this.confirming = false;
      if (!this.destroyed) this.cdr.markForCheck();
    }
  }

  private async requestSerialWaiver(): Promise<boolean> {
    const confirmed = await new Promise<string | null>(resolve => {
      this.backNavigation.runAfterOverlayClose(() => {
        if (this.destroyed) { resolve(null); return; }
        void this.actionModal.open({
          title: 'Criar checklist sem número de série?',
          message: 'Este checklist será criado sem um número de série vinculado. Deseja continuar?',
          confirmLabel: 'Continuar',
        }).then(resolve);
      });
      this.visible = false;
      this.cdr.detectChanges();
    });
    if (this.destroyed) return false;
    await new Promise<void>(resolve => this.backNavigation.runAfterOverlayClose(() => {
      if (!this.destroyed && !confirmed) {
        this.visible = true;
        this.cdr.detectChanges();
      }
      resolve();
    }));
    return !!confirmed;
  }

  private selectDefaultTemplate(): void {
    this.templateId = this.templates[0]?.id ?? '';
    this.predecessorId = '';
    this.resetIdentification();
  }

  private resetIdentification(): void {
    this.orderRequest?.unsubscribe();
    this.serialRequest?.unsubscribe();
    this.readyStock = false;
    this.availableSerials = [];
    this.loadingSerials = false;
    this.serialError = '';
    this.order = '';
    this.item = '';
    this.serial = '';
    this.erpOrder = undefined;
    this.loadingOrder = false;
    this.orderError = '';
  }
}

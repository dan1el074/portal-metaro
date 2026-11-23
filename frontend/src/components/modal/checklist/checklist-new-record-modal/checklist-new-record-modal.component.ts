import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Output, ViewChild, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistCreationOption, ChecklistPredecessor, ChecklistErpOrder, ChecklistRecordCreate, ChecklistService } from '../../../../app/services/checklist.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { Subscription } from 'rxjs';
import { ChecklistActionModalComponent } from '../checklist-action-modal/checklist-action-modal.component';
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

  protected get production(): boolean {
    return this.category?.integration === 'production';
  }

  protected get portalAdmin(): boolean {
    return this.store.user.roles.some(role => role.authority === 'ROLE_ADMIN');
  }

  protected get productionKit(): boolean {
    return this.production && this.selectedModel?.name.trim().toUpperCase() === 'KIT';
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

    this.serialRequest = this.api.availableSerials(this.readyStock ? '' : this.order.trim(), this.readyStock, this.item).subscribe({
      next: options => { this.availableSerials = options; this.loadingSerials = false; this.cdr.markForCheck(); },
      error: () => { this.serialError = 'Não foi possível consultar os números de série. Tente novamente.'; this.loadingSerials = false; this.cdr.markForCheck(); },
    });
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    this.predecessorRequest?.unsubscribe();
    this.orderRequest?.unsubscribe();
    this.serialRequest?.unsubscribe();
  }

  constructor(
    protected store: ChecklistPreviewService,
    private readonly api: ChecklistService,
    private readonly cdr: ChangeDetectorRef,
    private readonly backNavigation: BackNavigationService,
  ) {}

  public open(options: ChecklistCreationOption[]): void {
    this.options = options;
    this.categoryId = this.availableCategories[0]?.categoryId ?? '';
    this.selectDefaultTemplate();
    this.visible = true;
    this.cdr.detectChanges();
  }

  protected close(): void {
    this.visible = false;
    this.predecessorRequest?.unsubscribe();
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

  private options: ChecklistCreationOption[] = [];
  protected predecessors: ChecklistPredecessor[] = [];
  protected morePredecessors = false;
  protected loadingPredecessors = false;
  protected predecessorError = false;
  private predecessorPage = 0;
  private predecessorRequest?: Subscription;

  protected get category() { return this.options.find(option => option.categoryId === this.categoryId); }
  protected get availableCategories() {
    return Array.from(new Map(this.options.map(option => [option.categoryId, option])).values());
  }
  protected get templates() { return this.options.filter(option => option.categoryId === this.categoryId); }
  protected get selectedModel() { return this.templates.find(option => option.id === this.templateId); }
  protected get needsPredecessor() { return !!this.selectedModel && !this.selectedModel.standalone; }
  protected get hasPredecessor() { return !!this.selectedModel?.hasPredecessor; }

  protected loadPredecessors(): void {
    if (this.loadingPredecessors) return;
    this.loadingPredecessors = true;
    this.predecessorError = false;
    this.predecessorRequest = this.api.eligiblePredecessors(this.templateId, this.predecessorPage).subscribe({
      next: result => {
        this.predecessors = [...this.predecessors, ...result.content];
        this.predecessorPage++;
        this.morePredecessors = !result.last;
        this.loadingPredecessors = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.predecessorError = true;
        this.loadingPredecessors = false;
        this.cdr.markForCheck();
      },
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
    return !this.productionKit;
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
        this.item = result.items.length === 1 ? result.items[0].code : '';
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
      const needsConfirmation = withoutSerial || (this.readyStock && !this.predecessorId && !this.serial.trim());

      if (withoutSerial && !this.portalAdmin) return;
      if (needsConfirmation && !await this.requestSerialWaiver()) return;
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
        if (this.destroyed) {
          resolve(null);
          return;
        }

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
    this.predecessorRequest?.unsubscribe();
    this.predecessorPage = 0;
    this.predecessors = [];
    this.morePredecessors = false;
    this.loadingPredecessors = false;
    this.predecessorError = false;
    if (this.hasPredecessor) this.loadPredecessors();
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

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ToastrService } from '../../../../app/services/toast.service';
import { ChecklistErpOrder, ChecklistService } from '../../../../app/services/checklist.service';

@Component({
  selector: 'app-checklist-update-order-modal',
  imports: [FormsModule, ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective],
  templateUrl: './checklist-update-order-modal.component.html',
  styleUrl: './checklist-update-order-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistUpdateOrderModalComponent {
  @Output() updated = new EventEmitter<void>();
  protected visible = false;
  protected flowId = '';
  protected selectedOrder = '';
  protected selected?: ChecklistErpOrder;
  protected selectedItem = '';
  protected loading = false;

  constructor(protected store: ChecklistPreviewService, private api: ChecklistService, private toaster: ToastrService, private cdr: ChangeDetectorRef) {}

  public open(flowId: string): void {
    this.flowId = flowId;
    this.selectedOrder = '';
    this.selected = undefined;
    this.selectedItem = '';
    this.visible = true;
    this.cdr.detectChanges();
  }

  protected get flow() {
    return this.store.state().flows.find((item) => item.id === this.flowId);
  }

  protected get canSave(): boolean {
    return !!this.selected
      && !!this.selectedItem
      && String(this.selected.number) === this.selectedOrder.trim()
      && !this.loading;
  }

  protected search(): void {
    if (!this.selectedOrder.trim()) return;
    this.loading = true;
    this.api.findErpOrder(this.selectedOrder).subscribe({
      next: (order) => {
        this.selected = order;
        this.selectedItem = order.items.length === 1 ? this.formatItem(order.items[0]) : '';
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.selected = undefined; this.selectedItem = ''; this.loading = false; this.toaster.warning('Pedido não encontrado no ERP.'); this.cdr.detectChanges(); },
    });
  }

  protected close(): void {
    this.visible = false;
    this.cdr.detectChanges();
  }

  protected async save(): Promise<void> {
    try {
      if (!this.canSave) return;
      await this.store.updateFlowOrder(this.flowId, this.selectedOrder, this.selectedItem);
      this.close();
      this.updated.emit();
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível atualizar o pedido.');
    }
  }

  protected formatItem(item: ChecklistErpOrder['items'][number]): string {
    return `${item.code} - ${item.description}`;
  }
}

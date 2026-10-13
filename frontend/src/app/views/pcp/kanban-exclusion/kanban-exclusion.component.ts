import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, CardBodyComponent, CardComponent, ContainerComponent, FormControlDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, SpinnerComponent } from '@coreui/angular';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ModalBackNavigationDirective } from '../../../directive/modal-back-navigation.directive';
import { KanbanDeleteResult, KanbanItem } from '../../../interface/kanban-exclusion.interface';
import { KanbanExclusionService } from '../../../services/kanban-exclusion.service';
import { ToastrService } from '../../../services/toast.service';

@Component({
  selector: 'app-kanban-exclusion',
  imports: [
    CommonModule,
    FormsModule,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    FormControlDirective,
    SpinnerComponent,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonCloseDirective
  ],
  templateUrl: './kanban-exclusion.component.html',
  styleUrl: './kanban-exclusion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KanbanExclusionComponent {
  protected lotNumber = '';
  protected searchedLot: string | null = null;
  protected items: KanbanItem[] = [];
  protected selectedOrderIds = new Set<number>();
  protected searching = false;
  protected deleting = false;
  protected confirmVisible = false;

  constructor(
    private kanbanService: KanbanExclusionService,
    private toasterService: ToastrService,
    private cdr: ChangeDetectorRef
  ) {}

  protected get selectedCount(): number {
    return this.selectedOrderIds.size;
  }

  protected get allSelected(): boolean {
    return this.items.length > 0 && this.selectedCount === this.items.length;
  }

  protected get someSelected(): boolean {
    return this.selectedCount > 0 && !this.allSelected;
  }

  protected search(): void {
    if (this.searching || this.deleting) return;

    const lotNumber = this.lotNumber.trim();
    if (!/^\d+$/.test(lotNumber) || Number(lotNumber) <= 0) {
      this.toasterService.warning('Informe um número de lote válido.');
      return;
    }

    this.searching = true;
    this.items = [];
    this.selectedOrderIds.clear();
    this.kanbanService.findByLotNumber(lotNumber).subscribe({
      next: items => {
        this.items = items;
        this.searchedLot = lotNumber;
        this.searching = false;
        if (!items.length) {
          this.toasterService.info(`Nenhum item encontrado para o lote ${lotNumber}.`);
        }
        this.cdr.detectChanges();
      },
      error: error => {
        this.searchedLot = null;
        this.searching = false;
        this.toasterService.error(this.errorMessage(error, 'Não foi possível consultar o lote no ERP.'));
        this.cdr.detectChanges();
      }
    });
  }

  protected toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedOrderIds = checked
      ? new Set(this.items.map(item => item.orderId))
      : new Set<number>();
  }

  protected toggleItem(orderId: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const selection = new Set(this.selectedOrderIds);
    if (checked) {
      selection.add(orderId);
    } else {
      selection.delete(orderId);
    }
    this.selectedOrderIds = selection;
  }

  protected isSelected(orderId: number): boolean {
    return this.selectedOrderIds.has(orderId);
  }

  protected openConfirmation(): void {
    if (!this.selectedCount || this.deleting) return;
    this.confirmVisible = true;
  }

  protected closeConfirmation(): void {
    if (this.deleting) return;
    this.confirmVisible = false;
  }

  protected onConfirmationVisibleChange(visible: boolean): void {
    if (!visible) this.closeConfirmation();
  }

  protected confirmDeletion(): void {
    if (!this.selectedCount || this.deleting) return;

    const orderIds = Array.from(this.selectedOrderIds);
    this.deleting = true;

    const requests = orderIds.map(orderId =>
      this.kanbanService.deleteManufacturingOrder(orderId).pipe(
        map((response): KanbanDeleteResult => ({
          orderId,
          success: response.deleted,
          message: response.message
        })),
        catchError(error => of<KanbanDeleteResult>({
          orderId,
          success: false,
          message: this.errorMessage(error, `Não foi possível excluir a ordem ${orderId}.`)
        }))
      )
    );

    forkJoin(requests).subscribe(results => {
      const successfulIds = new Set(
        results.filter(result => result.success).map(result => result.orderId)
      );
      const failures = results.filter(result => !result.success);

      this.items = this.items.filter(item => !successfulIds.has(item.orderId));
      this.selectedOrderIds = new Set(failures.map(result => result.orderId));
      this.deleting = false;
      this.confirmVisible = false;

      const failureMessages = [...new Set(
        failures
          .map(result => result.message?.trim())
          .filter((message): message is string => !!message)
      )];
      failureMessages.forEach(message => this.toasterService.error(message));

      if (!failures.length) {
        const label = successfulIds.size === 1 ? 'item excluído' : 'itens excluídos';
        this.toasterService.success(`${successfulIds.size} ${label} com sucesso no ERP.`);
      } else if (successfulIds.size) {
        this.toasterService.warning(
          `${successfulIds.size} item(ns) excluído(s), mas ${failures.length} não puderam ser excluídos.`
        );
      } else if (!failureMessages.length) {
        this.toasterService.error('Não foi possível excluir os itens no ERP.');
      }

      this.cdr.detectChanges();
    });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage = error.error?.error;
      if (typeof apiMessage === 'string' && apiMessage.trim()) {
        return apiMessage;
      }
    }
    return fallback;
  }
}

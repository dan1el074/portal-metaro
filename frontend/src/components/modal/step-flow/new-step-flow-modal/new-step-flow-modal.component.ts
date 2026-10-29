import { ChangeDetectorRef, Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastrService } from '../../../../app/services/toast.service';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormLabelDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, SpinnerComponent } from '@coreui/angular';
import { StepFlowService } from '../../../../app/services/step-flow.service';
import { StepFlowChecklistEquipment, StepFlowOrderInfo, StepFlowOrderItem } from '../../../../app/interface/step-flow.interface';
import { CommonModule } from '@angular/common';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { catchError, map, of, switchMap } from 'rxjs';

@Component({
  selector: 'app-new-step-flow-modal',
  imports: [
    CommonModule,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalTitleDirective,
    ModalHeaderComponent,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    ButtonCloseDirective,
    ReactiveFormsModule,
    FormLabelDirective,
    FormControlDirective,
    SpinnerComponent
  ],
  templateUrl: './new-step-flow-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './new-step-flow-modal.component.scss',
})
export class NewStepFlowModalComponent {
  @Input() visible!: boolean;
  @Input() isAdmin = false;
  @Output() closeModal = new EventEmitter<void>();
  @Output() createNewOrder = new EventEmitter<StepFlowOrderInfo>();
  @Output() createLegacyOrder = new EventEmitter<StepFlowOrderInfo>();

  protected newOrderForm: FormGroup;
  protected itemsForm!: FormArray;
  protected valid: boolean | undefined = undefined;
  protected searchResult: StepFlowOrderInfo | null = null;
  protected loadSearch: boolean = false;
  protected duplicateWarningVisible = false;
  protected pendingOrder: StepFlowOrderInfo | null = null;
  protected pendingLegacy = false;
  protected checklistEquipment: StepFlowChecklistEquipment[] = [];

  protected get selectedChecklistEquipmentCount(): number {
    return this.checklistEquipment.filter(item => item.selected).length;
  }

  constructor(
    private formBuilder: FormBuilder,
    private stepFlowService: StepFlowService,
    private toaster: ToastrService,
    private cdf: ChangeDetectorRef
  ) {
    this.newOrderForm = this.formBuilder.group({
      number: ['', [Validators.required, Validators.pattern('^[0-9]+$')]],
      checklistIntegration: [true],
    });

    this.itemsForm = this.formBuilder.array([]);
  }

  protected get itemsFormControls(): FormGroup[] {
    return this.itemsForm.controls as FormGroup[];
  }

  protected get useChecklistIntegration(): boolean {
    return !this.isAdmin || this.newOrderForm.get('checklistIntegration')?.value !== false;
  }

  public ngOnChanges(): void {
    if (!this.visible) {
      this.resetForm();
    }
  }

  protected closeMemorandoModal(): void {
    this.closeModal.emit();
    this.resetForm();
  }

  protected handleVisibilityChange(event: boolean): void {
    if (!event && !this.duplicateWarningVisible) this.closeMemorandoModal();
  }

  private resetForm(): void {
    this.newOrderForm.reset({ number: '', checklistIntegration: true });
    this.itemsForm.clear();
    this.valid = undefined;
    this.searchResult = null;
    this.checklistEquipment = [];
    this.loadSearch = false;
    this.duplicateWarningVisible = false;
    this.pendingOrder = null;
    this.pendingLegacy = false;
  }

  protected onSearch(): void {
    if (!this.newOrderForm.valid) {
      this.valid = false;
      return;
    }

    this.loadSearch = true;
    this.searchResult = null;
    this.checklistEquipment = [];
    this.itemsForm.clear();

    this.stepFlowService.findOrderInfoByNumber(
      Number(this.newOrderForm.get('number')?.value)
    ).pipe(
      switchMap((data: StepFlowOrderInfo) =>
        this.stepFlowService.listAvailableChecklistEquipment(data.number)
          .pipe(
            catchError(() => {
              this.toaster.warning('Não foi possível carregar os checklists disponíveis. As quantidades do pedido continuam disponíveis.');
              return of([] as StepFlowChecklistEquipment[]);
            }),
            map(checklistEquipment => ({ data, checklistEquipment }))
          )
      )
    ).subscribe({
      next: ({ data, checklistEquipment }) => {
        this.searchResult = data;
        this.checklistEquipment = checklistEquipment;
        this.buildItemsForm(data.items);
        this.stopLoadButton();
      },
      error: error => {
        this.stopLoadButton();

        switch (error.status) {
          case 404:
            this.toaster.error("Pedido não encontrado!");
            break;

          case 422:
            this.toaster.error(error.error?.error || "Esse pedido já foi produzido!");
            break;

          case 502:
            this.toaster.error(error.error?.error || "Não foi possível consultar o FoccoERP.");
            break;

          default:
            this.toaster.error("Erro ao buscar Ordem");
            break;
        }
      }
    });
  }

  private buildItemsForm(items: Array<StepFlowOrderItem>): void {
  items.forEach(item => {
    const maxQuantity = item.quantity - item.producedQuantity;

    this.itemsForm.push(
      this.formBuilder.group({
        code: [item.code],
        description: [item.description],
        quantity: [item.quantity],
        maxQuantity: [maxQuantity],
        producedQuantity: [
          maxQuantity,
          [
            Validators.required,
            Validators.min(0),
            Validators.max(maxQuantity),
            Validators.pattern(/^\d+$/),
          ],
        ],
      })
    );
  });
}

  private stopLoadButton(): void {
    setTimeout(() => {
      this.loadSearch = false;
      this.cdf.detectChanges();
    }, 500);
  }

  protected onCreate(): void {
    if (!this.newOrderForm.valid || this.itemsForm.invalid) {
      this.itemsForm.markAllAsTouched();
      return;
    }

    const legacy = !this.useChecklistIntegration;
    const selectedEquipment = legacy ? [] : this.checklistEquipment.filter(item => item.selected);
    const updatedItems: StepFlowOrderItem[] = this.searchResult!.items.map((item, index) => ({
      ...item,
      producedQuantity: this.itemsForm.at(index).get('producedQuantity')?.value,
    }));

    const productionQuantity = updatedItems.reduce((total, item) => total + Number(item.producedQuantity), 0);
    if (selectedEquipment.length > productionQuantity) {
      this.toaster.error('A quantidade de equipamentos vinculados não pode ultrapassar a quantidade de itens a produzir.');
      return;
    }

    const exceedsAvailableQuantity = updatedItems.some((item, index) =>
      item.producedQuantity > Number(this.itemsForm.at(index).get('maxQuantity')?.value)
    );
    if (exceedsAvailableQuantity) {
      this.toaster.error('A quantidade de itens selecionados ultrapassa a quantidade disponível no pedido.');
      return;
    }

    const hasAtLeastOneItem = updatedItems.some(item => item.producedQuantity > 0);

    if (!hasAtLeastOneItem) {
      this.toaster.error('Informe a quantidade de ao menos um item para continuar.');
      return;
    }

    const updatedResult: StepFlowOrderInfo = {
      ...this.searchResult!,
      items: updatedItems,
      checklistFlowIds: selectedEquipment.map(item => item.flowId),
    };

    if (this.hasPreviouslyUsedQuantity()) {
      this.pendingOrder = updatedResult;
      this.pendingLegacy = legacy;
      this.duplicateWarningVisible = true;
      return;
    }

    this.emitCreation(updatedResult, legacy);
  }

  protected closeDuplicateWarning(): void {
    this.duplicateWarningVisible = false;
    this.pendingOrder = null;
    this.pendingLegacy = false;
  }

  protected confirmDuplicate(): void {
    if (!this.pendingOrder) return;

    const order = this.pendingOrder;
    const legacy = this.pendingLegacy;
    this.duplicateWarningVisible = false;
    this.pendingOrder = null;
    this.pendingLegacy = false;
    this.emitCreation(order, legacy);
  }

  private emitCreation(order: StepFlowOrderInfo, legacy: boolean): void {
    if (legacy) {
      this.createLegacyOrder.emit(order);
      return;
    }
    this.createNewOrder.emit(order);
  }

  private hasPreviouslyUsedQuantity(): boolean {
    return this.itemsForm.controls.some(control =>
      Number(control.get('maxQuantity')?.value) < Number(control.get('quantity')?.value)
    );
  }

  protected toggleChecklistEquipment(flowId: string, selected: boolean): void {
    this.checklistEquipment = this.checklistEquipment.map(item =>
      item.flowId === flowId ? { ...item, selected } : item
    );
  }

}

import { Component, ElementRef, EventEmitter, Input, OnChanges, SimpleChanges, Output, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { cilPencil } from '@coreui/icons';
import { ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent, ModalTitleDirective, ButtonCloseDirective, ButtonDirective, FormControlDirective, FormTextDirective } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

export interface EditableItem {
  id: number;
  code: string;
  description: string;
  quantity: number;
  producedQuantity: number;
}

@Component({
  selector: 'app-quantity-step-flow-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IconDirective,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ButtonDirective,
    FormControlDirective,
    FormTextDirective
  ],
  templateUrl: './quantity-step-flow-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './quantity-step-flow-modal.component.scss',
})
export class QuantityStepFlowModalComponent implements OnChanges {
  @ViewChild('quantityInput') quantityInput?: ElementRef<HTMLInputElement>;
  @Input() visible = false;
  @Input() saving = false;
  @Input() item: EditableItem | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<number>();

  protected readonly icons = { cilPencil };
  protected quantityControl = new FormControl<number>(0);

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['item'] && !changes['visible']) return;
    if (this.item) {
      this.quantityControl.setValidators([
        Validators.required,
        Validators.min(0),
        Validators.max(this.item.quantity),
        this.integerValidator.bind(this),
      ]);
      this.quantityControl.setValue(Math.trunc(this.item.producedQuantity), { emitEvent: false });
      this.quantityControl.updateValueAndValidity();
    }

    if (this.visible) {
      this.focusInputWhenReady();
    }
  }

  private focusInputWhenReady(): void {
    setTimeout(() => {
      this.quantityInput?.nativeElement.focus();
      this.quantityInput?.nativeElement.select();
    });
  }

  private integerValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (value === null || value === '' || value === undefined) {
      return null;
    }
    return Number.isInteger(Number(value)) ? null : { notInteger: true };
  }

  protected increment(): void {
  const max = this.item?.quantity ?? 0;
  const current = Math.trunc(this.quantityControl.value ?? 0);
  if (current < max) {
    this.quantityControl.setValue(current + 1);
  }
  this.refocusInput();
  }

  protected decrement(): void {
    const current = Math.trunc(this.quantityControl.value ?? 0);
    if (current > 0) {
      this.quantityControl.setValue(current - 1);
    }
    this.refocusInput();
  }

  private refocusInput(): void {
    setTimeout(() => {
      this.quantityInput?.nativeElement.focus();
    });
  }

  protected onKeyDown(event: KeyboardEvent): void {
    const blockedKeys = ['.', ',', 'e', 'E', '+', '-'];
    if (blockedKeys.includes(event.key)) {
      event.preventDefault();
    }
  }

  protected onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!/^\d+$/.test(pasted)) {
      event.preventDefault();
    }
  }

  protected onClose(): void {
    if (this.saving) return;
    this.close.emit();
  }

  protected onSave(): void {
    if (this.saving) return;
    if (this.quantityControl.invalid) {
      this.quantityControl.markAsTouched();
      return;
    }

    this.save.emit(this.quantityControl.value ?? 0);
  }

  protected onEnter(event: Event): void {
    event.preventDefault();
    this.onSave();
  }
}

import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import {
  ButtonCloseDirective,
  ButtonDirective,
  FormControlDirective,
  FormLabelDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  SpinnerComponent,
} from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { StepFlowVolume } from '../../../../app/interface/step-flow.interface';

@Component({
  selector: 'app-volume-step-flow-modal',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ButtonDirective,
    FormControlDirective,
    FormLabelDirective,
    SpinnerComponent,
  ],
  templateUrl: './volume-step-flow-modal.component.html',
  styleUrl: './volume-step-flow-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class VolumeStepFlowModalComponent implements OnChanges {
  @Input() visible = false;
  @Input() volume: StepFlowVolume | null = null;
  @Input() saving = false;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<StepFlowVolume>();

  protected readonly form = this.formBuilder.group({
    quantity: [1, [Validators.required, Validators.min(1), this.integerValidator]],
    length: [null as number | null, [Validators.required, Validators.min(0), this.decimalValidator]],
    width: [null as number | null, [Validators.required, Validators.min(0), this.decimalValidator]],
    height: [null as number | null, [Validators.required, Validators.min(0), this.decimalValidator]],
    weight: [null as number | null, [Validators.required, Validators.min(0), this.decimalValidator]],
  });

  constructor(private formBuilder: FormBuilder) {}

  public ngOnChanges(): void {
    if (!this.visible) return;

    this.form.reset({
      quantity: this.volume?.quantity ?? 1,
      length: this.volume?.length ?? null,
      width: this.volume?.width ?? null,
      height: this.volume?.height ?? null,
      weight: this.volume?.weight ?? null,
    });
  }

  private integerValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    return value === null || value === '' || Number.isInteger(Number(value)) ? null : { integer: true };
  }

  private decimalValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (value === null || value === '') return null;
    return /^\d+(?:[.,]\d{1,2})?$/.test(String(value)) ? null : { decimal: true };
  }

  protected onClose(): void {
    if (this.saving) return;
    this.close.emit();
  }

  protected onSave(): void {
    if (this.saving) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.save.emit({
      id: this.volume?.id ?? null,
      quantity: Number(value.quantity),
      length: this.asNumber(value.length),
      width: this.asNumber(value.width),
      height: this.asNumber(value.height),
      weight: this.asNumber(value.weight),
    });
  }

  private asNumber(value: number | string | null): number {
    return Number(String(value ?? 0).replace(',', '.'));
  }
}

import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormLabelDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

@Component({
  selector: 'app-cancel-step-flow-modal',
  imports: [
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonDirective,
    ReactiveFormsModule,
    FormsModule,
    FormControlDirective,
    FormLabelDirective,
  ],
  templateUrl: './cancel-step-flow-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './cancel-step-flow-modal.component.scss',
})
export class CancelStepFlowModalComponent {
  @Input() visible!: boolean;
  @Input() orderNumber!: number;
  @Output() close = new EventEmitter<void>();
  @Output() cancelTask = new EventEmitter<string>();
  protected form!: FormGroup;

  constructor(private formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      comment: ['', [Validators.required, Validators.minLength(10)]],
    });
  }

  protected onClose(): void {
    this.form.reset();
    this.close.emit();
  }

  protected handleVisibilityChange(event: boolean): void {
    if (!event) this.onClose();
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const message = this.form.get('comment')?.value;

    this.cancelTask.emit(message);
  }
}

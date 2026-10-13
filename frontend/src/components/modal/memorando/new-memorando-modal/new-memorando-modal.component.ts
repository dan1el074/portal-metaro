import { Component, EventEmitter, Input, OnChanges, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormLabelDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective } from '@coreui/angular';
import { cilPencil } from '@coreui/icons';
import { IconDirective } from '@coreui/icons-angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { ErpOrderSearch } from '../../../../app/interface/erp.interface';

@Component({
  selector: 'app-new-memorando-modal',
  imports: [
    ButtonDirective,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalTitleDirective,
    ButtonCloseDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    IconDirective,
    ReactiveFormsModule,
    FormLabelDirective,
    FormControlDirective
  ],
  templateUrl: './new-memorando-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './new-memorando-modal.component.scss',
})
export class NewMemorandoModalComponent implements OnChanges {
  @Input() visible!: boolean;
  @Output() closeModal = new EventEmitter<any>();
  @Output() createNewMemorando = new EventEmitter<ErpOrderSearch>();

  protected newMemorandoForm: FormGroup;
  protected showErrors = false;
  protected icons = { cilPencil };

  constructor(private formBuilder: FormBuilder) {
    this.newMemorandoForm = this.formBuilder.group({
      orderNumber: ['', [Validators.required, Validators.pattern('^[0-9]+$')]],
    });
  }

  public ngOnChanges(): void {
    if (!this.visible) {
      this.resetForm();
    }
  }

  protected closeMemorandoModal(): void {
    this.closeModal.emit();
    this.resetForm()
  }

  protected onSubmit(): void {
    if (!this.newMemorandoForm.valid) {
      this.showErrors = true;
      return;
    }

    this.createNewMemorando.emit({
      orderNumber: Number(this.newMemorandoForm.get('orderNumber')?.value),
      source: 'FOCCO',
    });
  }

  private resetForm(): void {
    this.newMemorandoForm.reset({ orderNumber: '' });
  }
}

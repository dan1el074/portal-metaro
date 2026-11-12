import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

@Component({
  selector: 'app-reprocess-step-flow-modal',
  imports: [ModalComponent, ModalBackNavigationDirective, ModalHeaderComponent, ModalTitleDirective, ButtonCloseDirective, ModalBodyComponent, ModalFooterComponent, ButtonDirective],
  templateUrl: './reprocess-step-flow-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ReprocessStepFlowModalComponent {
  @Input() visible = false;
  @Input() processing = false;
  @Input() orderNumber: string | number = '';
  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  protected onClose(): void { this.close.emit(); }
}

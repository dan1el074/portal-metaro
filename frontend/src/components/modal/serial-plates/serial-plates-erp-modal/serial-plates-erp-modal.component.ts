import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonCloseDirective, ButtonDirective, ModalModule } from '@coreui/angular';

@Component({
  selector: 'app-serial-plates-erp-modal',
  imports: [ButtonCloseDirective, ButtonDirective, ModalModule],
  templateUrl: './serial-plates-erp-modal.component.html',
  styleUrl: './serial-plates-modal.scss'
})
export class SerialPlatesErpModalComponent {
  @Input() public visible = false;
  @Input() public count = 0;
  @Output() public visibleChange = new EventEmitter<boolean>();
  @Output() public cancel = new EventEmitter<void>();
  @Output() public confirm = new EventEmitter<void>();
}

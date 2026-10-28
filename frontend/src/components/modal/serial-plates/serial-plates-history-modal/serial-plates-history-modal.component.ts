import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ButtonCloseDirective, ButtonDirective, ModalModule } from '@coreui/angular';
import { PlateHistory, SerialPlate } from '../../../../app/interface/serial-plates.interface';

@Component({
  selector: 'app-serial-plates-history-modal',
  imports: [CommonModule, ButtonCloseDirective, ButtonDirective, ModalModule],
  templateUrl: './serial-plates-history-modal.component.html',
  styleUrl: './serial-plates-modal.scss'
})
export class SerialPlatesHistoryModalComponent {
  @Input() public record: SerialPlate | null = null;
  @Input() public events: PlateHistory[] = [];

  public serialLabel(value: string): string {
    return value.replace(/^0+(?=\d)/, '');
  }
}

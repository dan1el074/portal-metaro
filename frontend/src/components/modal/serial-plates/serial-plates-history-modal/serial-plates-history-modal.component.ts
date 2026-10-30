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

  public historyValue(field: string, value: string | null | undefined): string {
    const text = value?.trim() ?? '';
    if (!text) return '(vazio)';
    if (field === 'Capacidade') return /\bton$/i.test(text) ? text : `${text} ton`;
    if (field === 'Peso' || field === 'kg/un') return /\bkg$/i.test(text) ? text : `${text} kg`;
    if (field === 'Pronta Entrega') return text === 'true' ? 'Sim' : text === 'false' ? 'Não' : text;
    if (field === 'Data de fabricação' && /^\d{4}-(0[1-9]|1[0-2])$/.test(text)) return `${text.slice(5)}/${text.slice(0, 4)}`;
    return text;
  }

  public serialLabel(value: string): string {
    return value.replace(/^0+(?=\d)/, '');
  }
}

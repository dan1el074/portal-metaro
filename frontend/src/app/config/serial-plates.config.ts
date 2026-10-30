import type { PlatePatch, PlateSettings } from '../interface/serial-plates.interface';

export const STATUSES = ['Criado', 'Programado', 'Recebido', 'Devolvido', 'Finalizado'] as const;
export const FIELD_LABELS: Record<keyof PlatePatch, string> = {
  of: 'OF', order: 'Nº Pedido', orderItem: 'Item do pedido', readyStock: 'Pronta Entrega (PE)', client: 'Cliente', description: 'Modelo', capacity: 'Capacidade',
  voltage: 'Voltagem', weight: 'kg/un', provider: 'Prestador de serviço', status: 'Status',
  notes: 'Observações', manufactured: 'Data de fabricação',
};
export const DEFAULT_SETTINGS: PlateSettings = {
  crea: 'RS 169445',
  instructions: 'Conferir os dados antes da gravação. Retornar as plaquetas identificadas pelo número de série.',
  providers: 'Interno\nRosset\nSabrina',
};
export const SERIAL_PLATES_REPORT_COLUMNS = ['Nº Série', 'Modelo', 'Fabricação', 'Tensão', 'CREA', 'Peso'] as const;
export const SERIAL_PLATES_PAGE_SIZES = [10, 30, 50, 100, 200];
export const SERIAL_PLATES_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

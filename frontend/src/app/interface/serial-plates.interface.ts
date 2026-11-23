// Terceiro is read-only legacy data; new selections use STATUSES.
export type PlateStatus = 'Criado' | 'Programado' | 'Recebido' | 'Devolvido' | 'Finalizado' | 'Terceiro';
export type PlatePatch = Partial<Omit<SerialPlate, 'serial' | 'history' | 'updated' | 'version'>>;
export type SerialPlateDialog = '' | 'new' | 'edit' | 'batch' | 'settings' | 'report';

export interface PlateHistory {
  at: string;
  author: string;
  changes: { field: string; before: string; after: string; }[];
}

export interface SerialPlateRelocation {
  serial: string;
  order: string;
  stepFlows: string[];
}

export interface SerialPlate {
  serial: string;
  version: number;
  of: string;
  order: string;
  orderItemCode: string;
  readyStock: boolean;
  client: string;
  description: string;
  capacity: number | null;
  voltage: string;
  weight: number | null;
  provider: string;
  status: PlateStatus;
  notes: string;
  manufactured: string;
  updated: string;
  history?: PlateHistory[];
}

export type SerialPlateReportColumn = 'serial' | 'description' | 'manufactured' | 'voltage' | 'crea' | 'weight';

export interface PlateSettings {
  reportColumns?: SerialPlateReportColumn[];
  crea: string;
  instructions: string;
  providers: string;
}

export interface ErpOrderItem {
  itemCode: string;
  orderDescription?: string;
  label?: string;
  description: string;
  capacity: number | null;
  voltage: string;
  weight: number | null;
}

export interface ErpOrder {
  client: string;
  items: ErpOrderItem[];
}

export interface SerialPlateCreateDraft {
  quantity: number;
  of: string;
  order: string;
  orderItemCode: string;
}

export interface SerialPlateBatchFields {
  of: boolean;
  order: boolean;
  readyStock: boolean;
  provider: boolean;
  status: boolean;
  manufactured: boolean;
  weight: boolean;
  voltage: boolean;
}

export interface SerialPlateStore {
  records: SerialPlate[];
  settings: PlateSettings;
}

export type SerialPlateListRow = Pick<SerialPlate,
  'serial' | 'of' | 'order' | 'readyStock' | 'client' | 'description' | 'provider' | 'status' | 'notes' | 'updated'>;

export interface SerialPlateQuery {
  page: number;
  size: number;
  search: string;
  status: string;
  sortColumn: keyof SerialPlateListRow;
  sortDirection: 'asc' | 'desc';
}

export interface SerialPlatePage {
  content: SerialPlateListRow[];
  totalElements: number;
  totalPages: number;
}

export interface SerialPlateSelection {
  serial: string;
  event: MouseEvent;
}

export type SerialPlateVersion = Pick<SerialPlate, 'serial' | 'version'>;
export interface SerialPlateBatchRow extends SerialPlateVersion { equipmentData: boolean; }
export type SerialPlateReportRow = Pick<SerialPlate, 'serial' | 'description' | 'voltage' | 'weight' | 'manufactured'>;
export interface SerialPlateReport {
  records: SerialPlateReportRow[];
  settings: PlateSettings;
}

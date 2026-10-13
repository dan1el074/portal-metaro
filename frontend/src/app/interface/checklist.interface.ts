export type Integration = 'production' | '5s' | 'none';
export type Status =
  | 'Rascunho'
  | 'Em andamento'
  | 'Pendente'
  | 'Finalizado'
  | 'Cancelado';
export interface Field {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'datetime-local' | 'select';
  options: string[];
  defaultValue: string;
}
export interface Category {
  id: string;
  name: string;
  integration: Integration;
  active: boolean;
  reason: string;
  logo: boolean;
  re: string;
  ref: string;
  documentTitle: string;
  clientNokHistory: boolean;
  dates: boolean;
  departments: boolean;
  serial: boolean;
  erp: boolean;
  fields: Field[];
  operators: number[];
}
export interface Equipment {
  id: string;
  name: string;
  abbreviation: string;
}
export interface Question {
  id: string;
  label: string;
  fields: Field[];
}
export interface Section {
  id: string;
  name: string;
  options: string[];
  questions: Question[];
}
export interface Template {
  id: string;
  categoryId: string;
  name: string;
  equipmentId: string;
  title: string;
  sections: Section[];
  signature: boolean;
  predecessorId: string;
  automatic: boolean;
  version: number;
}
export interface Evidence {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  publicUrl?: string;
  previewUrl?: string;
}
export type NokFieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'items'
  | 'defects'
  | 'departments'
  | 'files';
export type NokFieldBinding =
  | 'item'
  | 'code'
  | 'defect'
  | 'description'
  | 'department'
  | 'media';
export interface NokFormField {
  id: string;
  label: string;
  type: NokFieldType;
  required: boolean;
  binding?: NokFieldBinding;
}
export interface Problem {
  id: string;
  item: string;
  code: string;
  defect: string;
  description: string;
  department: string;
  media: Evidence[];
  customFields: Record<string, string>;
  treated: boolean;
  commentId?: string;
}
export interface Answer {
  value: string;
  description: string;
  fields: Record<string, string>;
  problems: Problem[];
}
export interface Audit {
  id: string;
  at: string;
  actor: string;
  action: string;
}
export interface Comment {
  id: string;
  authorId: number;
  author: string;
  at: string;
  text: string;
  problemId?: string;
}
export interface Snapshot {
  template: Template;
  category: Category;
  equipment: string;
}
export interface Flow {
  id: string;
  serial: string;
  order: string;
  clientId: string;
  client: string;
  item: string;
  seller: string;
  plan: Snapshot[];
  skipped: Record<string, string>;
  cancelled: boolean;
}
export interface Checklist {
  id: string;
  flowId: string;
  templateId: string;
  creatorId: number;
  ownerId: number | null;
  owner: string;
  finisherId?: number;
  signature?: string;
  signedAt?: string;
  created: string;
  updated: string;
  finished?: string;
  status: Status;
  automatic: boolean;
  answers: Record<string, Answer>;
  fields: Record<string, string>;
  departments: string[];
  comments: Comment[];
  logs: Audit[];
  revisions: Revision[];
}
export interface Revision {
  at: string;
  actor: string;
  record: Omit<Checklist, 'revisions'>;
}
export interface PreviewProcess {
  id: string;
  order: string;
  item: string;
  flowIds: string[];
  categoryId: string;
  stage: string;
  requested: boolean;
  done: boolean;
  cancelled: boolean;
}
export interface ChecklistState {
  schema: number;
  categories: Category[];
  equipment: Equipment[];
  templates: Template[];
  flows: Flow[];
  records: Checklist[];
  items: string[];
  defects: string[];
  nokFields: NokFormField[];
  processes: PreviewProcess[];
}
export interface ChecklistTableRow {
  id: string;
  number: number;
  title: string;
  category: string;
  categoryId: string;
  model: string;
  equipment: string;
  equipmentId: string;
  serial: string;
  status: Status;
  updated: string;
}

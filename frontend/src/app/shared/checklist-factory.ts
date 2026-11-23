import { Category, Field, NokFormField, Question, Section } from '../interface/checklist.interface';

// Unsaved form rows and local file previews use negative keys until persistence.
let temporaryId = 0;
export const checklistId = (): string => String(--temporaryId);
export const checklistCopy = <T>(value: T): T => structuredClone(value);
export const checklistNow = (): string => new Date().toISOString();
export const CHECKLIST_BODY_EVIDENCE_ID = '0';

export const emptyChecklistField = (): Field => ({ id: checklistId(), label: '', type: 'text', options: [], defaultValue: '' });
export const emptyChecklistQuestion = (): Question => ({ id: checklistId(), label: '', fields: [] });
export const emptyChecklistSection = (production: boolean): Section => ({ id: checklistId(), name: '', options: production ? ['OK', 'NOK', 'N/A'] : ['OK', 'N/A'], questions: [emptyChecklistQuestion()] });
export const emptyChecklistCategory = (): Category => ({ id: checklistId(), name: '', integration: 'production', active: true, reason: '', logo: true, re: '', ref: '', documentTitle: 'Checklist de inspeção da qualidade', clientNokHistory: true, dates: false, departments: false, serial: true, erp: true, media: true, fields: [], operators: [] });
export const defaultChecklistNokFields = (): NokFormField[] => [
  { id: 'nok-item', label: 'Tipo de item', type: 'items', required: true, binding: 'item' },
  { id: 'nok-code', label: 'Código', type: 'text', required: false, binding: 'code' },
  { id: 'nok-defect', label: 'Tipo de defeito', type: 'defects', required: true, binding: 'defect' },
  { id: 'nok-department', label: 'Setor responsável', type: 'departments', required: true, binding: 'department' },
  { id: 'nok-description', label: 'Complemento', type: 'textarea', required: false, binding: 'description' },
  { id: 'nok-media', label: 'Fotos e vídeos', type: 'files', required: false, binding: 'media' },
];

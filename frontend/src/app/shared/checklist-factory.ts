import { Category, Field, NokFormField, Question, Section } from '../interface/checklist.interface';

export const checklistId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
};
export const checklistCopy = <T>(value: T): T => structuredClone(value);
export const checklistNow = (): string => new Date().toISOString();

export const emptyChecklistField = (): Field => ({ id: checklistId(), label: '', type: 'text', options: [], defaultValue: '' });
export const emptyChecklistQuestion = (): Question => ({ id: checklistId(), label: '', fields: [] });
export const emptyChecklistSection = (production: boolean): Section => ({ id: checklistId(), name: '', options: production ? ['OK', 'NOK', 'N/A'] : ['OK', 'N/A'], questions: [emptyChecklistQuestion()] });
export const emptyChecklistCategory = (): Category => ({ id: checklistId(), name: '', integration: 'production', active: true, reason: '', logo: true, re: '', ref: '', documentTitle: 'Checklist de inspeção da qualidade', clientNokHistory: true, dates: false, departments: true, serial: true, erp: true, fields: [], operators: [] });
export const defaultChecklistNokFields = (): NokFormField[] => [
  { id: 'nok-item', label: 'Tipo de item', type: 'items', required: true, binding: 'item' },
  { id: 'nok-code', label: 'Código', type: 'text', required: true, binding: 'code' },
  { id: 'nok-defect', label: 'Tipo de defeito', type: 'defects', required: true, binding: 'defect' },
  { id: 'nok-department', label: 'Setor responsável', type: 'departments', required: true, binding: 'department' },
  { id: 'nok-description', label: 'Não conformidade', type: 'textarea', required: true, binding: 'description' },
  { id: 'nok-media', label: 'Fotos e vídeos', type: 'files', required: false, binding: 'media' },
];

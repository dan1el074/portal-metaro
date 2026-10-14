import { Checklist, Flow, Template } from '../interface/checklist.interface';
import { recordTitle } from './checklist-rules';

describe('checklist rules', () => {
  it('usa a resposta do primeiro campo adicional na variável da pergunta', () => {
    const template = {
      id: 'template',
      categoryId: 'category',
      name: 'Modelo',
      equipmentId: '',
      title: 'Lote %1.1',
      sections: [{
        id: 'section',
        name: 'Seção',
        options: ['OK', 'N/A'],
        questions: [{
          id: 'question',
          label: 'Identificação',
          fields: [
            { id: 'batch', label: 'Lote', type: 'text', options: [], defaultValue: '' },
            { id: 'note', label: 'Observação', type: 'text', options: [], defaultValue: '' },
          ],
        }],
      }],
      signature: false,
      predecessorId: '',
      automatic: false,
      version: 1,
    } satisfies Template;
    const flow = {
      id: 'flow',
      serial: '',
      order: '',
      clientId: '',
      client: '',
      item: '',
      seller: '',
      plan: [{ template, category: {} as Flow['plan'][number]['category'], equipment: '' }],
      skipped: {},
      cancelled: false,
    } satisfies Flow;
    const record = {
      id: 'record',
      flowId: flow.id,
      templateId: template.id,
      creatorId: 1,
      ownerId: 1,
      owner: 'Operador',
      created: '2026-10-14T12:00:00.000Z',
      updated: '2026-10-14T12:00:00.000Z',
      status: 'Rascunho',
      automatic: false,
      answers: {
        question: {
          value: 'OK',
          description: '',
          fields: { batch: 'ABC-123', note: 'Texto que não deve compor o título' },
          problems: [],
        },
      },
      fields: {},
      departments: [],
      comments: [],
      logs: [],
      revisions: [],
    } satisfies Checklist;

    expect(recordTitle(record, flow)).toBe('Lote ABC-123');
  });
});

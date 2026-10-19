import { Checklist, Flow, Template } from '../interface/checklist.interface';
import { recordTitle, validateRecord } from './checklist-rules';
import { defaultChecklistNokFields } from './checklist-factory';

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
      optionalPredecessor: false,
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

  it('permite finalizar registros ERP legados sem o identificador interno do cliente', () => {
    const { record, flow } = validRecord('EQUIPAMENTO');
    flow.clientId = '';
    expect(validateRecord(record, flow)).toBeNull();
  });

  it('permite número de série vazio somente para o equipamento de produção KIT', () => {
    const kit = validRecord('KIT');
    kit.flow.serial = '';
    expect(validateRecord(kit.record, kit.flow)).toBeNull();

    const equipment = validRecord('EQUIPAMENTO');
    equipment.flow.serial = '';
    expect(validateRecord(equipment.record, equipment.flow)).toBe('Informe o número de série.');
  });

  it('mantém código e complemento do NOK como opcionais', () => {
    const fields = defaultChecklistNokFields();

    expect(fields.find((field) => field.binding === 'code')?.required).toBeFalse();
    expect(fields.find((field) => field.binding === 'description')?.required).toBeFalse();
  });
});

function validRecord(name: string): { record: Checklist; flow: Flow } {
  const template: Template = {
    id: 'template', categoryId: 'category', name, equipmentId: 'equipment', title: '%data',
    sections: [], signature: true, predecessorId: '', automatic: false, optionalPredecessor: false, version: 1,
  };
  const flow: Flow = {
    id: 'flow', serial: 'SERIE', order: '123', clientId: 'client', client: 'Cliente', item: 'Item', seller: '',
    plan: [{
      template,
      category: {
        id: 'category', name: 'Produção', integration: 'production', active: true, reason: '', logo: true,
        re: '', ref: '', documentTitle: '', clientNokHistory: true, dates: false, departments: false,
        serial: true, erp: true, fields: [], operators: [],
      },
      equipment: name,
    }],
    skipped: {}, cancelled: false,
  };
  const record: Checklist = {
    id: 'record', flowId: flow.id, templateId: template.id, creatorId: 1, ownerId: 1, owner: 'Operador',
    created: '', updated: '', status: 'Rascunho', automatic: false, answers: {}, fields: {}, departments: [],
    comments: [], logs: [], revisions: [],
  };
  return { record, flow };
}

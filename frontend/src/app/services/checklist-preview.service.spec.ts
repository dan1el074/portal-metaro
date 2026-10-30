import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ChecklistPreviewService } from './checklist-preview.service';
import { UserService } from './user.service';
import { ChecklistMediaPreviewService } from './checklist-media-preview.service';

describe('Checklist server context and audit normalization', () => {
  let store: ChecklistPreviewService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: UserService, useValue: { getCurrentUser: () => ({ id: 1, name: 'Admin', roles: [{ authority: 'ROLE_ADMIN' }] }) } },
      { provide: ChecklistMediaPreviewService, useValue: {} },
    ] });
    store = TestBed.inject(ChecklistPreviewService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function flushContext(id: string, actions: string[] = []): void {
    http.expectOne(request => request.url.endsWith('/records/' + id)).flush({ id, flowId: id, templateId: 't', status: 'JUSTIFIED', answers: {},
      logs: actions.map((action, index) => ({ id: index + 1, action, details: 'Detalhes do evento ' + action, actor: 'Operador' })),
    });
    http.expectOne(request => request.url.endsWith('/records/' + id + '/flow')).flush({ id, plan: [], skipped: {} });
    const listing = http.match(request => request.url.endsWith('/records'));
    listing[listing.length - 1].flush({ content: [] });
    // More than one context can request the list concurrently.
    for (const request of listing.slice(0, -1)) request.flush({ content: [] });
  }

  it('normalizes Justificado and human audit messages without discarding details from other modules', async () => {
    const actions = ['CREATED', 'CLAIMED', 'FINISHED', 'PROBLEM_TREATED', 'GENERATED', 'REOPENED', 'DELEGATED', 'TREATMENT_REVERSED', 'CANCELLED', 'SERIAL_PLATE_UPDATED'];
    const loaded = store.loadRecordContext('1'); flushContext('1', actions);
    const record = await loaded;
    expect(record.status).toBe('Justificado');
    expect(record.logs.map(log => log.action)).toEqual(['Checklist iniciado', 'Assumiu o preenchimento do checklist', 'Checklist finalizado',
      'Tratou uma não conformidade (NOK)', 'Checklist gerado automaticamente pelo fluxo', 'Checklist reaberto para edição',
      'Delegou o checklist para outro operador', 'Reverteu o tratamento de uma não conformidade', 'Cancelou o fluxo de checklist', 'Dados atualizados pelo PCP']);
    expect(record.logs[9].details).toBe('Detalhes do evento SERIAL_PLATE_UPDATED');
    expect(record.logs[9].displayDetails).toBeUndefined();
    expect(record.logs[0].displayDetails).toBeUndefined();
    expect(store.state().records[0]).toBe(record);
    expect(store.state().flows[0].id).toBe('1');
  });

  it('shows only the previous and new order in PCP relocation messages while preserving the full audit', async () => {
    const loaded = store.loadRecordContext('1');
    const details = 'Atualização por Nº Série/Plaquetas (PCP), série 18918. Pedido: 246 → 244; Cliente: Antigo → Novo; Item: A → B';
    http.expectOne(request => request.url.endsWith('/records/1')).flush({ id: '1', flowId: '1', templateId: 't', status: 'IN_PROGRESS',
      logs: [{ id: 1, action: 'SERIAL_PLATE_UPDATED', actor: 'Daniel Vargas', details }],
    });
    http.expectOne(request => request.url.endsWith('/records/1/flow')).flush({ id: '1', plan: [], skipped: {} });
    http.expectOne(request => request.url.endsWith('/records')).flush({ content: [] });
    const record = await loaded;
    expect(record.logs[0].actor).toBe('Daniel Vargas');
    expect(record.logs[0].action).toBe('Pedido atualizado pelo PCP: 246 → 244.');
    expect(record.logs[0].displayDetails).toBeUndefined();
    expect(record.logs[0].details).toBe(details);
  });

  it('identifies the NOK in historical treatment events that stored only its internal ID', async () => {
    const loaded = store.loadRecordContext('1');
    http.expectOne(request => request.url.endsWith('/records/1')).flush({ id: '1', flowId: '1', templateId: 't', status: 'PENDING',
      answers: { q: { problems: [{ id: 'internal-uuid', item: 'Mesa', code: 'M1', defect: 'Pintura' }] } },
      logs: [{ id: 1, action: 'PROBLEM_TREATED', details: 'Problema internal-uuid tratado.' }],
    });
    http.expectOne(request => request.url.endsWith('/records/1/flow')).flush({ id: '1', plan: [], skipped: {} });
    http.expectOne(request => request.url.endsWith('/records')).flush({ content: [] });
    const record = await loaded;
    expect(record.logs[0].details).toBe('Não conformidade: Mesa — M1.');
  });

  it('reports a successful deletion even if the subsequent list refresh fails', async () => {
    const loaded = store.loadRecordContext('1'); flushContext('1'); await loaded;
    spyOn(store, 'load').and.rejectWith(new Error('List refresh failed'));
    const deleted = store.deleteDraft('1');
    http.expectOne(request => request.method === 'DELETE' && request.url.endsWith('/records/1')).flush(null);
    await expectAsync(deleted).toBeResolved();
    expect(store.state().records).toEqual([]);
    expect(store.state().flows).toEqual([]);
  });
});

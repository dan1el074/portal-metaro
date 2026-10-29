import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, of } from 'rxjs';
import { ChecklistRecordDetailComponent } from './checklist-record-detail.component';
import { ChecklistPreviewService } from '../../../../../services/checklist-preview.service';
import { ChecklistService } from '../../../../../services/checklist.service';
import { ToastrService } from '../../../../../services/toast.service';
import { BackNavigationService } from '../../../../../services/back-navigation.service';
import { emptyChecklistCategory } from '../../../../../shared/checklist-factory';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}

describe('Checklist detail loading, history and deletion', () => {
  let fixture: ComponentFixture<ChecklistRecordDetailComponent>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let store: any;
  let api: any;
  let toast: any;
  let navigate: jasmine.Spy;
  const category = { ...emptyChecklistCategory(), id: 'c', name: 'Inspeção', erp: false, serial: false };
  const snapshots = ['t1', 't2'].map((id, index) => ({ category, equipment: '', template: {
    id, name: 'Modelo ' + (index + 1), categoryId: 'c', signature: false,
    sections: [{ id: 's', name: 'Conferência', options: ['OK', 'NOK'], questions: [{ id: 'q', label: 'Verificar componente', fields: [] }] }],
  } }));
  const flow = { id: 'f', plan: snapshots, skipped: { t2: 'Não se aplica' }, cancelled: false, clientId: '', serial: '', order: '' };
  const records = ['1', '2'].map((id, index) => ({
    id, flowId: 'f', templateId: 't' + id, status: index ? 'Justificado' : 'Rascunho', creatorId: 1, ownerId: 1,
    fields: {}, departments: [], media: [], comments: [], revisions: [],
    answers: { q: { value: index ? null : 'OK', description: '', fields: {}, problems: [] } },
    logs: [{ id: 'a' + id, actor: 'PCP', action: 'Dados atualizados pelo PCP', details: 'Pedido: 900 → 901', displayDetails: 'Pedido: 900 → 901', at: '2026-10-29T12:00:00Z' }],
  }));

  beforeEach(async () => {
    params = new BehaviorSubject(convertToParamMap({ id: '1' }));
    store = { state: signal({ categories: [category], records, flows: [flow], templates: snapshots.map(item => item.template) }),
      user: { id: 1, name: 'Administrador' }, admin: true, operator: true,
      load: jasmine.createSpy().and.resolveTo(undefined),
      loadRecordContext: jasmine.createSpy().and.callFake((id: string) => Promise.resolve(records.find(record => record.id === id))),
      flow: () => flow, snapshot: (record: any) => snapshots.find(item => item.template.id === record.templateId),
      visible: () => true, editable: () => false, title: (record: any) => 'Checklist ' + record.id,
      clientNokHistoryEnabled: () => false, deleteDraft: jasmine.createSpy(),
    };
    api = { listLinkedStepFlows: jasmine.createSpy().and.returnValue(of([
      { id: 10, order: '900', status: 'Concluído', currentStep: 'Expedição', linked: false },
      { id: 11, order: '901', status: 'Andamento', currentStep: 'PCP', linked: true },
    ])) };
    toast = jasmine.createSpyObj('ToastrService', ['success', 'warning']);
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(),
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: ChecklistPreviewService, useValue: store }, { provide: ChecklistService, useValue: api },
      { provide: ToastrService, useValue: toast },
      { provide: BackNavigationService, useValue: { register: jasmine.createSpy(), unregister: jasmine.createSpy(), runAfterOverlayClose: (action: () => void) => action() } },
    ] });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ChecklistRecordDetailComponent);
    fixture.detectChanges(); await settle();
  });
  afterEach(async () => { fixture.destroy(); await new Promise(resolve => setTimeout(resolve, 80)); });

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  }


  it('shows current and past step flow links and the PCP audit details', () => {
    expect(fixture.nativeElement.querySelectorAll('.linked-step-flow-list a').length).toBe(2);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Vínculo anterior'); expect(text).toContain('Vínculo atual');
    expect(text).toContain('Pedido: 900 → 901');
  });

  it('keeps the document hidden until both record context and linked flows finish loading', async () => {
    const context = deferred<any>(); const links = new Subject<any[]>();
    store.loadRecordContext.and.returnValue(context.promise); api.listLinkedStepFlows.and.returnValue(links);
    params.next(convertToParamMap({ id: '2' })); await settle();
    expect(fixture.nativeElement.querySelector('.checklist-loading c-spinner')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.document-card')).toBeNull();
    context.resolve(records[1]); await settle();
    expect(fixture.nativeElement.querySelector('.document-card')).toBeNull();
    links.next([]); links.complete(); await settle();
    expect(fixture.nativeElement.querySelector('.document-header h1').textContent).toContain('Modelo 2');
    expect(fixture.nativeElement.querySelector('.status-badge').textContent).toContain('Justificado');
    expect(fixture.nativeElement.querySelectorAll('.answer-checkbox.checked').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Voltar para edição');
  });

  it('ignores a slower response after navigation to a different checklist', async () => {
    const slow = deferred<any>();
    store.loadRecordContext.and.callFake((id: string) => id === '2' ? slow.promise : Promise.resolve(records[0]));
    params.next(convertToParamMap({ id: '2' })); await settle();
    params.next(convertToParamMap({ id: '1' })); await settle();
    slow.resolve(records[1]); await settle();
    expect(fixture.nativeElement.querySelector('.document-header h1').textContent).toContain('Modelo 1');
    expect(fixture.nativeElement.querySelector('.detail-breadcrumb strong').textContent).toBe('Checklist 1');
  });

  it('shows a retry action instead of old data when loading fails', async () => {
    store.loadRecordContext.and.rejectWith(new Error('Network error'));
    params.next(convertToParamMap({ id: '2' })); await settle();
    expect(fixture.nativeElement.querySelector('.document-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Não foi possível carregar');
    store.loadRecordContext.and.resolveTo(records[1]);
    (fixture.nativeElement.querySelector('.checklist-loading button') as HTMLButtonElement).click();
    await settle();
    expect(fixture.nativeElement.querySelector('.document-header h1').textContent).toContain('Modelo 2');
  });

  async function confirmDeletion(): Promise<HTMLButtonElement> {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.includes('Excluir rascunho'))!.click(); await settle();
    const confirm = Array.from(fixture.nativeElement.querySelectorAll('app-checklist-action-modal c-modal-footer button'))
      .find((button: any) => button.textContent?.trim() === 'Excluir') as HTMLButtonElement;
    confirm.click(); await settle(); return confirm;
  }

  it('animates deletion and reports success only when the server completes it', async () => {
    const deletion = deferred<void>(); store.deleteDraft.and.returnValue(deletion.promise);
    const confirm = await confirmDeletion();
    expect(confirm.disabled).toBeTrue(); expect(confirm.querySelector('c-spinner')).not.toBeNull();
    expect(toast.success).not.toHaveBeenCalled(); expect(navigate).not.toHaveBeenCalled();
    confirm.click(); expect(store.deleteDraft).toHaveBeenCalledTimes(1);
    deletion.resolve(); await settle();
    expect(toast.success).toHaveBeenCalledWith('Checklist excluído com sucesso.');
    expect(navigate).toHaveBeenCalledWith(['/qualidade/checklist']);
  });

  it('keeps the delete dialog open and allows retry after a failure', async () => {
    const deletion = deferred<void>(); store.deleteDraft.and.returnValue(deletion.promise);
    const confirm = await confirmDeletion();
    deletion.reject(new Error('Sem conexão')); await settle();
    expect(confirm.disabled).toBeFalse(); expect(confirm.querySelector('c-spinner')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-checklist-action-modal [role="alert"]').textContent).toContain('Sem conexão');
    expect(navigate).not.toHaveBeenCalled(); expect(toast.success).not.toHaveBeenCalled();
  });
});

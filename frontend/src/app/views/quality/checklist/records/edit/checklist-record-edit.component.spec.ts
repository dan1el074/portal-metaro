import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ChecklistRecordEditComponent } from './checklist-record-edit.component';
import { ChecklistPreviewService } from '../../../../../services/checklist-preview.service';
import { ChecklistService } from '../../../../../services/checklist.service';
import { ToastrService } from '../../../../../services/toast.service';
import { BackNavigationService } from '../../../../../services/back-navigation.service';

describe('Checklist memorandum alerts during filling and completion', () => {
  let fixture: ComponentFixture<ChecklistRecordEditComponent>;
  let component: any;
  let api: any;
  let store: any;
  let toast: any;
  const open = { id: 261, number: 406, title: 'Componente elétrico', createAt: '2026-11-16T12:00:00Z', status: 'PUBLISH' };
  const approved = { ...open, id: 262, number: 407, status: 'APPROVED' };

  beforeEach(async () => {
    const record = { id: '1', flowId: 'f' };
    store = {
      state: signal({ records: [record] }), load: jasmine.createSpy().and.resolveTo(),
      editable: () => true, claim: jasmine.createSpy().and.resolveTo(), flow: () => ({ id: 'f', order: '688', item: '60310 - Item' }),
      saveRecord: jasmine.createSpy().and.resolveTo(record),
    };
    api = { listRelatedMemorandos: jasmine.createSpy().and.returnValue(of([open, approved])) };
    toast = jasmine.createSpyObj('ToastrService', ['success', 'warning']);
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(), provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      { provide: ChecklistPreviewService, useValue: store }, { provide: ChecklistService, useValue: api },
      { provide: ToastrService, useValue: toast },
      { provide: BackNavigationService, useValue: jasmine.createSpyObj('BackNavigationService', ['register', 'unregister', 'runAfterOverlayClose']) },
    ] });
    TestBed.overrideComponent(ChecklistRecordEditComponent, { set: {
      template: '<app-checklist-action-modal /><app-checklist-memorandos-modal />',
    } });
    (TestBed.inject(BackNavigationService).runAfterOverlayClose as jasmine.Spy).and.callFake((action: () => void) => action());
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ChecklistRecordEditComponent); component = fixture.componentInstance;
    fixture.detectChanges(); await settle();
  });

  afterEach(() => fixture.destroy());

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0)); await fixture.whenStable(); fixture.detectChanges();
  }

  async function click(label: string): Promise<void> {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('app-checklist-memorandos-modal button, app-checklist-action-modal button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.trim() === label)!.click(); await settle();
  }

  it('opens the warning with links to all related memorandums', () => {
    expect(fixture.nativeElement.querySelector('.memorandos-warning-header')).not.toBeNull();
    const links = fixture.nativeElement.querySelectorAll('a.memorando-card');
    expect(links.length).toBe(2); expect(links[0].getAttribute('href')).toBe('/general/memorando/261');
    expect(links[0].getAttribute('target')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('406/2026');
  });

  it('closes the warning before opening a memorandum in the same tab', async () => {
    const link = fixture.nativeElement.querySelector('a.memorando-card') as HTMLAnchorElement;
    link.click(); await settle();
    expect(TestBed.inject(BackNavigationService).runAfterOverlayClose).toHaveBeenCalled();
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/general/memorando', 261]);
    expect(store.saveRecord).not.toHaveBeenCalled();
  });

  it('queries again at completion and only saves after explicit confirmation', async () => {
    await click('Entendido'); api.listRelatedMemorandos.and.returnValue(of([open, approved]));
    const saving = component.save(true); await settle();
    expect(api.listRelatedMemorandos).toHaveBeenCalledTimes(2); expect(store.saveRecord).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-checklist-action-modal h5').textContent).toContain('Finalizar checklist?');
    expect(fixture.nativeElement.querySelector('app-checklist-action-modal .modal-message').textContent).toContain('Existe ao menos um memorando aberto');
    expect(fixture.nativeElement.textContent).toContain('Essa ação será registrada.');
    await component.save(true); expect(api.listRelatedMemorandos).toHaveBeenCalledTimes(2);
    await click('Continuar e finalizar'); await saving;
    expect(store.saveRecord).toHaveBeenCalledOnceWith(component.record, component.flow, true, true);
  });

  it('uses the latest approval status without asking for an override', async () => {
    await click('Entendido'); api.listRelatedMemorandos.and.returnValue(of([approved]));
    await component.save(true);
    expect(store.saveRecord).toHaveBeenCalledOnceWith(component.record, component.flow, true, false);
  });

  it('preserves the answers and does not save when the confirmation is canceled', async () => {
    await click('Entendido'); component.dirty = true;
    const saving = component.save(true); await settle(); await click('Cancelar'); await saving;
    expect(store.saveRecord).not.toHaveBeenCalled(); expect(component.dirty).toBeTrue(); expect(component.saving).toBeFalse();
  });

  it('does not complete when the fresh query fails', async () => {
    await click('Entendido'); api.listRelatedMemorandos.and.returnValue(throwError(() => new Error('Sem conexão')));
    await component.save(true);
    expect(store.saveRecord).not.toHaveBeenCalled(); expect(toast.warning).toHaveBeenCalled(); expect(component.saving).toBeFalse();
  });

  it('saves drafts without the completion warning', async () => {
    await click('Entendido'); api.listRelatedMemorandos.calls.reset();
    await component.save(false);
    expect(api.listRelatedMemorandos).not.toHaveBeenCalled();
    expect(store.saveRecord).toHaveBeenCalledOnceWith(component.record, component.flow, false, false);
  });
});

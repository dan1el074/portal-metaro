import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SerialPlatesComponent } from './serial-plates.component';
import { SerialPlate } from '../../../interface/serial-plates.interface';
import { UserService } from '../../../services/user.service';
import { ToastrService } from '../../../services/toast.service';

// Native Angular tests: HTTP contracts and component coordination, without local fixtures in production.
describe('SerialPlatesComponent API integration', () => {
  let http: HttpTestingController;
  let component: SerialPlatesComponent;
  let fixture: ComponentFixture<SerialPlatesComponent>;
  let roles: string[];
  const settings = { crea: 'RS 169445', instructions: '', providers: 'Interno' };
  const row: SerialPlate = {
    serial: '18918', version: 0, of: '8301', order: '', orderItem: '', readyStock: false,
    client: '', description: '', capacity: null, voltage: '', weight: null, provider: '',
    status: 'Criado', notes: '', manufactured: '2026-10', updated: '2026-10-23T12:00:00Z', history: []
  };

  beforeEach(() => {
    roles = ['ROLE_SERIAL_PLATES_OPERATOR'];
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
      { provide: UserService, useValue: { getCurrentUser: () => ({ id: 1, roles: roles.map(authority => ({ authority })) }) } },
      { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['warning', 'success']) }
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  async function waitForRelocation(): Promise<HTMLElement> {
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      await fixture.whenStable();
      const action = fixture.nativeElement.querySelector('app-checklist-action-modal') as HTMLElement;
      if (action?.querySelector('c-modal[aria-modal="true"]')) return action;
    }
    throw new Error('Relocation confirmation did not remain visible');
  }

  function initialize(): void {
    fixture = TestBed.createComponent(SerialPlatesComponent);
    component = fixture.componentInstance;
    http.expectOne(request => request.url.endsWith('/settings')).flush(settings);
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [row], totalElements: 31, totalPages: 4 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 31, Criado: 31 });
  }

  afterEach(() => { fixture?.destroy(); http.verify(); });

  it('renders the server page using the real component templates', async () => {
    fixture = TestBed.createComponent(SerialPlatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    http.expectOne(request => request.url.endsWith('/settings')).flush(settings);
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [row], totalElements: 31, totalPages: 4 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 31, Criado: 31 });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('18918');
    expect(fixture.nativeElement.textContent).toContain('31');
  });

  it('offers returned status before finalized and removes the retired status from edit options', async () => {
    initialize(); fixture.detectChanges(); await fixture.whenStable();
    expect(component.summaries.map(item => item.status)).toEqual(['Criado', 'Programado', 'Recebido', 'Devolvido', 'Finalizado']);
    const open = component.openEdit(row);
    http.expectOne(request => request.url.endsWith('/18918')).flush(row);
    await open; await fixture.whenStable();
    const status = Array.from(fixture.nativeElement.querySelectorAll('label')).find((label: any) => label.textContent?.startsWith('Status')) as HTMLLabelElement;
    expect(Array.from(status.querySelectorAll('option')).map(option => option.textContent?.trim())).toEqual(['Criado', 'Programado', 'Recebido', 'Devolvido', 'Finalizado']);
  });

  it('loads one server page and uses server totals for cards and pagination', () => {
    initialize();
    expect(component.records.length).toBe(1);
    expect(component.pages()).toBe(4);
    expect(component.countStatus('')).toBe(31);
    expect(component.countStatus('Criado')).toBe(31);
  });

  it('requests the next page with stable sort while preserving selection', () => {
    initialize();
    component.toggleAll(true);
    component.setPage(2);
    const next = http.expectOne(request => request.url.endsWith('/serial-plates'));
    expect(next.request.params.get('page')).toBe('1');
    expect(next.request.params.get('sort')).toBe('serial,desc');
    next.flush({ content: [], totalElements: 31, totalPages: 4 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 31 });
    expect(component.selected.has('18918')).toBeTrue();
    expect(component.selectedRows()[0].serial).toBe('18918');
  });

  it('queries Focco before revealing batch order items and invalidates changed orders', async () => {
    initialize();
    component.open('batch'); component.batchFields.order = true; component.changeBatchOrder('900');
    const pending = component.loadBatchErp();
    expect(component.batchOrderItems).toEqual([]);
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush({ client: 'Cliente', items: [{ id: 'item', description: 'Modelo', capacity: 1.5, voltage: '220v TRI', weight: null }] });
    await pending;
    expect(component.batchOrderItems.length).toBe(1);
    component.changeBatchOrder('901');
    expect(component.batchOrderItems).toEqual([]);
    expect(component.batch.orderItem).toBe('');
  });

  it('sends record versions and retains PE values until save', async () => {
    initialize();
    component.edit = { ...row, order: '900', client: 'Cliente' };
    component.setReadyStock(true);
    expect(component.edit.order).toBe('900');
    expect(component.edit.client).toBe('Cliente');
    const pending = component.saveEdit();
    http.expectOne(request => request.url.endsWith('/relocation-impact')).flush([]);
    await Promise.resolve();
    const update = http.expectOne(request => request.url.endsWith('/18918'));
    expect(update.request.body.versions).toEqual({ '18918': 0 });
    expect(update.request.body.patch.order).toBe('');
    expect(update.request.body.patch.client).toBe('');
    update.flush({ ...row, version: 1, readyStock: true });
    await pending;
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [], totalElements: 1, totalPages: 1 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 1 });
  });

  it('opens the edit modal and updates history after responses without another interaction', async () => {
    initialize();
    fixture.detectChanges();
    await fixture.whenStable();
    const pending = component.openEdit(row);
    http.expectOne(request => request.url.endsWith('/18918')).flush(row);
    await pending;
    await fixture.whenStable();
    const modal = fixture.nativeElement.querySelector('#serialPlateModal');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(modal.textContent).toContain('#18918');
    component.openHistory();
    await fixture.whenStable();
    http.expectOne(request => request.url.endsWith('/18918/history')).flush([{ at: row.updated, author: 'Operador API', changes: [{ field: 'Peso', before: '', after: '350' }] }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#serialPlateHistoryModal').textContent).toContain('Operador API');
  });

  it('updates creation order items when the ERP lookup completes without a click', async () => {
    initialize();
    component.open('new');
    component.createDraft.order = '900';
    fixture.detectChanges();
    await fixture.whenStable();
    const pending = component.loadCreateOrder();
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush({ client: 'Cliente', items: [{ id: 'item', description: 'Modelo ERP', capacity: 1.5, voltage: '220v TRI', weight: null }] });
    await pending;
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#serialPlateModal').textContent).toContain('Modelo ERP');
  });

  it('sends the checked batch weight and preserves all unmarked fields', async () => {
    initialize();
    component.toggleAll(true);
    component.open('batch');
    component.batchFields.weight = true;
    component.batch.weight = 400;
    const pending = component.saveBatch();
    const update = http.expectOne(request => request.url.endsWith('/batch'));
    expect(update.request.body.patch).toEqual({ weight: 400 });
    expect(update.request.body.fields).toEqual(['weight']);
    update.flush([{ ...row, weight: 400, version: 1 }]);
    await pending;
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [{ ...row, weight: 400 }], totalElements: 1, totalPages: 1 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 1 });
  });

  it('keeps the manually entered batch weight when an ERP order is applied together', async () => {
    initialize();
    component.toggleAll(true);
    component.open('batch');
    component.batchFields.order = true;
    component.batchFields.weight = true;
    component.batch = { order: '900', orderItem: 'item', weight: 400 };
    const item = { id: 'item', description: 'Modelo ERP', capacity: 1.5, voltage: '220v TRI', weight: 300 };
    component.batchOrderItems = [item];
    const pending = component.saveBatch();
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush({ client: 'Cliente', items: [item] });
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(request => request.url.endsWith('/selection')).flush([row]);
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(request => request.url.endsWith('/relocation-impact')).flush([]);
    await new Promise(resolve => setTimeout(resolve, 0));
    const update = http.expectOne(request => request.url.endsWith('/batch'));
    expect(update.request.body.patch.weight).toBe(400);
    update.flush([{ ...row, order: '900', orderItem: 'item', description: 'Modelo ERP', weight: 400, version: 1 }]);
    await pending;
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [], totalElements: 1, totalPages: 1 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 1 });
  });

  it('searches another ERP order after PE is enabled and its update checkbox is disabled again', async () => {
    initialize();
    component.open('batch');
    component.batchFields.order = true;
    component.changeBatchOrder('900');
    const item = { id: 'first', description: 'Primeiro item', capacity: 1, voltage: '220v TRI', weight: 300 };
    const first = component.loadBatchErp();
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush({ client: 'Cliente', items: [item] });
    await first;
    component.batch.orderItem = 'first';
    component.batchFields.readyStock = true;
    component.setBatchReadyStock(true);
    expect(component.batchFields.order).toBeFalse();
    component.batchFields.readyStock = false;
    component.batchFields.order = true;
    component.changeBatchOrder('901');
    const second = component.loadBatchErp();
    http.expectOne(request => request.url.endsWith('/erp/orders/901')).flush({ client: 'Outro cliente', items: [{ ...item, id: 'second' }] });
    await second;
    expect(component.batchOrderItems.map(value => value.id)).toEqual(['second']);
    expect(component.batch.orderItem).toBe('');
  });

  it('sends only the checked batch voltage', async () => {
    initialize();
    component.toggleAll(true);
    component.open('batch');
    component.batchFields.voltage = true;
    component.batch.voltage = '380v BI';
    const pending = component.saveBatch();
    const update = http.expectOne(request => request.url.endsWith('/batch'));
    expect(update.request.body.patch).toEqual({ voltage: '380v BI' });
    expect(update.request.body.fields).toEqual(['voltage']);
    update.flush([{ ...row, voltage: '380v BI', version: 1 }]);
    await pending;
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [], totalElements: 1, totalPages: 1 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 1 });
  });

  it('keeps edit and batch unit indicators out of the Tab sequence', async () => {
    initialize();
    component.edit = { ...row };
    component.open('edit');
    fixture.detectChanges();
    await fixture.whenStable();
    const editUnits = fixture.nativeElement.querySelectorAll('#serialPlateModal .unit-tooltip');
    expect(editUnits.length).toBe(2);
    editUnits.forEach((unit: HTMLElement) => expect(unit.tabIndex).toBe(-1));
    component.open('batch');
    fixture.detectChanges();
    await fixture.whenStable();
    const batchUnits = fixture.nativeElement.querySelectorAll('#serialPlateModal .unit-tooltip');
    expect(batchUnits.length).toBe(1);
    batchUnits.forEach((unit: HTMLElement) => expect(unit.tabIndex).toBe(-1));
  });

  it('requires relocation confirmation and preserves the edit when cancelled', async () => {
    initialize(); fixture.detectChanges(); await fixture.whenStable();
    component.edit = { ...row, order: '900', orderItem: 'old', client: 'Cliente' };
    component.open('edit'); component.setReadyStock(true);
    await fixture.whenStable();
    const pending = component.saveEdit();
    http.expectOne(request => request.url.endsWith('/relocation-impact')).flush([{ serial: '18918', order: '', stepFlows: ['900'] }]);
    await waitForRelocation();
    expect(fixture.nativeElement.textContent).toContain('A etapa, o status, as quantidades e os demais equipamentos serão preservados');
    http.expectNone(request => request.method === 'PUT');
    const action = fixture.nativeElement.querySelector('app-checklist-action-modal');
    const cancel = Array.from(action.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Cancelar')!;
    cancel.click(); await pending; await fixture.whenStable();
    expect(component.modalVisible).toBeTrue(); expect(component.busy).toBeFalse();
    http.expectNone(request => request.method === 'PUT');
    const retry = component.saveEdit();
    http.expectOne(request => request.url.endsWith('/relocation-impact')).flush([{ serial: '18918', order: '', stepFlows: ['900'] }]);
    await waitForRelocation();
    const confirm = Array.from(action.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Confirmar realocação')!;
    confirm.click(); await new Promise(resolve => setTimeout(resolve, 60));
    const update = http.expectOne(request => request.url.endsWith('/18918'));
    expect(update.request.body.confirmRelocation).toBeTrue();
    expect(update.request.body.versions).toEqual({ '18918': 0 });
    update.flush({ ...row, readyStock: true, version: 1 }); await retry;
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [], totalElements: 1, totalPages: 1 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 1 });
  });

  it('keeps relocation visible after closing the edit overlay and saves the changed order after confirmation', async () => {
    initialize(); fixture.detectChanges(); await fixture.whenStable();
    const open = component.openEdit({ ...row, order: '900', orderItem: 'old' });
    http.expectOne(request => request.url.endsWith('/18918')).flush({ ...row, order: '900', orderItem: 'old', client: 'Antigo', description: 'Modelo A' });
    await open;
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush({ client: 'Antigo', items: [{ id: 'old', description: 'Modelo A' }] });
    await fixture.whenStable();
    component.changeEditOrder('901');
    const lookup = component.loadErp('new');
    http.expectOne(request => request.url.endsWith('/erp/orders/901')).flush({ client: 'Novo', items: [{ id: 'new', description: 'Modelo B', capacity: 1, voltage: '380V', weight: 300 }] });
    await lookup; await new Promise(resolve => setTimeout(resolve, 80)); await fixture.whenStable();
    component.confirmErp(); await new Promise(resolve => setTimeout(resolve, 80)); await fixture.whenStable();
    const saving = component.saveEdit();
    http.expectOne(request => request.url.endsWith('/relocation-impact')).flush([{ serial: '18918', order: '901', stepFlows: ['900'] }]);
    const action = await waitForRelocation();
    await new Promise(resolve => setTimeout(resolve, 80)); await fixture.whenStable();
    expect(action.querySelector('c-modal')?.getAttribute('aria-modal')).toBe('true');
    http.expectNone(request => request.method === 'PUT');
    const confirm = Array.from(action.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Confirmar realocação')!;
    confirm.click(); await new Promise(resolve => setTimeout(resolve, 80)); await fixture.whenStable();
    const update = http.expectOne(request => request.url.endsWith('/18918'));
    expect(update.request.body.patch.order).toBe('901'); expect(update.request.body.confirmRelocation).toBeTrue();
    update.flush({ ...row, order: '901', client: 'Novo', orderItem: 'new', version: 1 }); await saving;
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [], totalElements: 1, totalPages: 1 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 1 });
    expect(component.busy).toBeFalse(); expect(component.modalVisible).toBeFalse();
  });

  it('does not grant operator rights through the old Kanban role', () => {
    roles.splice(0, roles.length, 'ROLE_KANBAN_EXCLUSION');
    initialize();
    expect(component.canEdit()).toBeFalse();
    component.open('report');
    expect(component.modalVisible).toBeFalse();
    http.expectNone(request => request.url.endsWith('/report'));
  });
});

import { TestBed } from '@angular/core/testing';
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
      provideHttpClient(), provideHttpClientTesting(),
      { provide: UserService, useValue: { getCurrentUser: () => ({ id: 1, roles: roles.map(authority => ({ authority })) }) } },
      { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['warning', 'success']) }
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  function initialize(): void {
    component = TestBed.runInInjectionContext(() => new SerialPlatesComponent());
    http.expectOne(request => request.url.endsWith('/settings')).flush(settings);
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [row], totalElements: 31, totalPages: 4 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 31, Criado: 31 });
  }

  afterEach(() => { component?.ngOnDestroy(); http.verify(); });

  it('renders the server page using the real component templates', async () => {
    const fixture = TestBed.createComponent(SerialPlatesComponent);
    component = fixture.componentInstance;
    http.expectOne(request => request.url.endsWith('/settings')).flush(settings);
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [row], totalElements: 31, totalPages: 4 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 31, Criado: 31 });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('18918');
    expect(fixture.nativeElement.textContent).toContain('31');
    fixture.destroy();
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
    const update = http.expectOne(request => request.url.endsWith('/18918'));
    expect(update.request.body.versions).toEqual({ '18918': 0 });
    expect(update.request.body.patch.order).toBe('');
    expect(update.request.body.patch.client).toBe('');
    update.flush({ ...row, version: 1, readyStock: true });
    await pending;
    http.expectOne(request => request.url.endsWith('/serial-plates')).flush({ content: [], totalElements: 1, totalPages: 1 });
    http.expectOne(request => request.url.endsWith('/summary')).flush({ total: 1 });
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

import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { StepFlowOffcanvasComponent } from './step-flow-offcanvas.component';
import { ToastrService } from '../../../app/services/toast.service';
import { BackNavigationService } from '../../../app/services/back-navigation.service';

describe('Step flow viewing offcanvas administrator stage selection', () => {
  let fixture: ComponentFixture<StepFlowOffcanvasComponent>;
  let http: HttpTestingController;
  const titles = ['Consulta', 'Montagem Final', 'PCP', 'Frete', 'Faturamento', 'Expedição'];
  const steps = titles.map((title, id) => ({ id, title, description: '', icon: '', count: 0, lateCount: 0 }));
  const order = {
    id: 1, number: '900', client: 'Cliente', cnpj: '123', currentStep: 'PCP', nextStep: 'Frete',
    status: 'Andamento', checklistIntegration: false, steps: [], volumes: [], pictures: [], videos: [], items: [],
    observation: 'Observação do pedido',
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [
      provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['success', 'error']) },
      { provide: BackNavigationService, useValue: jasmine.createSpyObj('BackNavigationService', ['register', 'unregister']) },
    ] });
    fixture = TestBed.createComponent(StepFlowOffcanvasComponent);
    fixture.componentRef.setInput('isAdmin', true);
    fixture.componentRef.setInput('steps', steps);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    await open();
  });

  afterEach(() => { fixture.destroy(); http.verify(); });

  async function open(status = 'Andamento'): Promise<void> {
    fixture.componentInstance.open(1);
    http.expectOne(request => request.url.endsWith('/step-flow/1')).flush({ ...order, status });
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([]);
    await fixture.whenStable();
  }

  function selectStage(id: number): void {
    const select = fixture.nativeElement.querySelector('#viewSetStage') as HTMLSelectElement;
    select.value = String(id);
    select.dispatchEvent(new Event('change'));
  }

  it('shows all five production stages at the end of the Timeline for the portal administrator', () => {
    const form = fixture.nativeElement.querySelector('.admin-stage-form') as HTMLFormElement;
    const scroll = form.closest('.sof-scroll');
    expect(scroll?.lastElementChild).toBe(form);
    expect(form.closest('.timeline-panel')).not.toBeNull();
    expect(form.previousElementSibling?.classList.contains('timeline-obs')).toBeTrue();
    const select = form.querySelector('select') as HTMLSelectElement;
    expect(Array.from(select.options).map(option => option.textContent?.trim())).toEqual(titles.slice(1));
    expect(select.value).toBe('2');
    expect((form.querySelector('button') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('hides the selector for other profiles and refuses programmatic submission', async () => {
    fixture.componentRef.setInput('isAdmin', false); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.admin-stage-form')).toBeNull();
    (fixture.componentInstance as any).adminStepControl.setValue(4);
    (fixture.componentInstance as any).saveStage();
    http.expectNone(request => request.method === 'PUT');
  });

  it('saves only the requested stage and updates the timeline, current stage and list', async () => {
    const reload = spyOn(fixture.componentInstance.reloadOrders, 'emit');
    selectStage(4); await fixture.whenStable();
    const save = fixture.nativeElement.querySelector('.admin-stage-form button') as HTMLButtonElement;
    expect(save.disabled).toBeFalse(); save.click(); await fixture.whenStable();
    expect(save.disabled).toBeTrue();
    const request = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1'));
    expect(Array.from((request.request.body as FormData).keys())).toEqual(['setStage']);
    expect((request.request.body as FormData).get('setStage')).toBe('3');
    request.flush({ ...order, currentStep: 'Faturamento', nextStep: 'Expedição' });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.current-step strong').textContent).toBe('Faturamento');
    expect((fixture.nativeElement.querySelector('#viewSetStage') as HTMLSelectElement).value).toBe('4');
    expect(save.disabled).toBeTrue();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('preserves the selected stage and current data when saving fails', async () => {
    const reload = spyOn(fixture.componentInstance.reloadOrders, 'emit');
    selectStage(1); await fixture.whenStable();
    (fixture.nativeElement.querySelector('.admin-stage-form button') as HTMLButtonElement).click();
    http.expectOne(request => request.method === 'PUT').flush(
      { error: 'Não é possível editar um pedido cancelado!' }, { status: 422, statusText: 'Unprocessable Entity' }
    );
    await fixture.whenStable();
    expect((fixture.nativeElement.querySelector('#viewSetStage') as HTMLSelectElement).value).toBe('1');
    expect(fixture.nativeElement.querySelector('.current-step strong').textContent).toBe('PCP');
    expect((fixture.nativeElement.querySelector('.admin-stage-form button') as HTMLButtonElement).disabled).toBeFalse();
    expect(reload).not.toHaveBeenCalled();
    expect(TestBed.inject(ToastrService).error).toHaveBeenCalledWith('Não é possível editar um pedido cancelado!');
  });

  it('preserves the existing rule against editing completed or cancelled orders', async () => {
    for (const status of ['Cancelado', 'Concluído']) {
      await open(status);
      expect(fixture.nativeElement.querySelector('.admin-stage-form')).toBeNull();
    }
  });
});

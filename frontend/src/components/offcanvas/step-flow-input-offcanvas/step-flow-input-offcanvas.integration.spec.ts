import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { StepFlowInputOffcanvasComponent } from './step-flow-input-offcanvas.component';
import { QuantityStepFlowModalComponent } from '../../modal/step-flow/quantity-step-flow-modal/quantity-step-flow-modal.component';
import { ToastrService } from '../../../app/services/toast.service';
import { BackNavigationService } from '../../../app/services/back-navigation.service';

describe('Step flow quantities remain independent when editing linked checklists', () => {
  let fixture: ComponentFixture<StepFlowInputOffcanvasComponent>;
  let http: HttpTestingController;
  const order = {
    id: 1, number: '900', client: 'Cliente', cnpj: '123', currentStep: 'Montagem Final', nextStep: 'PCP',
    status: 'Andamento', checklistIntegration: true, steps: [], volumes: [], pictures: [], videos: [],
    items: [{ id: 5, code: 42, description: 'Mesa', quantity: 4, producedQuantity: 3 }],
  };
  const checklist = { flowId: '7', recordId: '1', serial: '18918', item: 'Mesa', selected: true };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: ToastrService, useValue: jasmine.createSpyObj('ToastrService', ['error', 'success', 'warning']) },
      { provide: BackNavigationService, useValue: jasmine.createSpyObj('BackNavigationService', ['register', 'unregister']) },
    ] });
    fixture = TestBed.createComponent(StepFlowInputOffcanvasComponent);
    fixture.componentRef.setInput('isAdmin', false); fixture.componentRef.setInput('steps', []);
    http = TestBed.inject(HttpTestingController); fixture.detectChanges();
    fixture.componentInstance.open(1);
    http.expectOne(request => request.url.endsWith('/step-flow/1')).flush(order);
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([checklist]);
    await fixture.whenStable();
  });

  afterEach(() => { fixture.destroy(); http.verify(); });

  it('renders the usual quantity editor even with checklist integration and sends the entered quantity', async () => {
    expect(fixture.nativeElement.querySelector('.produced-item-quantity').textContent).toContain('3 / 4');
    const edit = fixture.nativeElement.querySelector('.sof-file-edit-icon') as HTMLButtonElement;
    expect(edit).not.toBeNull(); edit.click(); await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(QuantityStepFlowModalComponent)).componentInstance as QuantityStepFlowModalComponent;
    modal.save.emit(2); await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const update = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1'));
    expect(JSON.parse((update.request.body as FormData).get('itemsJson') as string)).toEqual([{ id: 5, producedQuantity: 2 }]);
    http.expectNone(request => request.method === 'PUT' && request.url.endsWith('/equipment'));
    update.flush({ ...order, items: [{ ...order.items[0], producedQuantity: 2 }] });
    await fixture.whenStable();
  });

  function submit(): void {
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  it('renders linked and available checklists in the same item style with a count below the title', async () => {
    const section = fixture.nativeElement.querySelector('.checklist-equipment-box') as HTMLElement;
    expect(section.querySelector('.custom-label')?.textContent).toBe('Checklists vinculados');
    expect(section.querySelector('.checklist-count')?.textContent).toContain('1 de 3 equipamento(s) vinculado(s)');
    expect(section.querySelector('.sof-file-item .produced-item-box')).not.toBeNull();
    expect(Array.from(section.querySelectorAll('button')).some(button => button.textContent?.includes('Salvar vínculos'))).toBeFalse();
  });

  it('removes a checklist using the final Save button and saves quantities and selection in one request', async () => {
    const section = fixture.nativeElement.querySelector('.checklist-equipment-box') as HTMLElement;
    (section.querySelector('input[type="checkbox"]') as HTMLInputElement).click(); await fixture.whenStable();
    http.expectNone(request => request.method === 'PUT');
    expect(fixture.nativeElement.querySelectorAll('.linked-checklist-box .linked-checklist-item').length).toBe(1);
    const save = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    save.click();
    const update = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1'));
    expect(JSON.parse((update.request.body as FormData).get('checklistFlowIdsJson') as string)).toEqual([]);
    expect(JSON.parse((update.request.body as FormData).get('itemsJson') as string)).toEqual([{ id: 5, producedQuantity: 3 }]);
    http.expectNone(request => request.method === 'PUT' && request.url.endsWith('/equipment'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.linked-checklist-box .linked-checklist-item').length).toBe(1);
    update.flush(order);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.linked-checklist-box')).toBeNull();
    http.expectOne(request => request.method === 'GET' && request.url.endsWith('/orders/1/equipment')).flush([{ ...checklist, selected: false }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.produced-item-quantity').textContent).toContain('3 / 4');
    expect(section.querySelector('.checklist-count')?.textContent).toContain('0 de 3');
  });

  async function loadAvailable(): Promise<void> {
    fixture.componentInstance.open(1);
    http.expectOne(request => request.url.endsWith('/step-flow/1')).flush(order);
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([
      checklist, ...['8', '9', '10'].map(flowId => ({ ...checklist, flowId, selected: false })),
    ]);
    await fixture.whenStable();
  }

  function checkboxes(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.checklist-equipment-box input[type="checkbox"]'));
  }

  it('limits linked equipment to the configured production quantity while keeping selected equipment removable', async () => {
    await loadAvailable(); checkboxes()[1].click(); checkboxes()[2].click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.checklist-count').textContent).toContain('3 de 3');
    expect(checkboxes()[3].disabled).toBeTrue(); expect(checkboxes()[0].disabled).toBeFalse();
    checkboxes()[0].click(); await fixture.whenStable();
    expect(checkboxes()[3].disabled).toBeFalse();
    http.expectNone(request => request.method === 'PUT');
  });

  it('requires removing excess links when the quantity is reduced and saves both changes atomically', async () => {
    await loadAvailable(); checkboxes()[1].click(); checkboxes()[2].click(); await fixture.whenStable();
    (fixture.nativeElement.querySelector('.sof-file-edit-icon') as HTMLButtonElement).click(); await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(QuantityStepFlowModalComponent)).componentInstance as QuantityStepFlowModalComponent;
    modal.save.emit(2); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.checklist-count').textContent).toContain('3 de 2');
    expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
    submit(); http.expectNone(request => request.method === 'PUT');
    checkboxes()[2].click(); await fixture.whenStable(); submit();
    const update = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1'));
    expect(JSON.parse((update.request.body as FormData).get('checklistFlowIdsJson') as string)).toEqual(['7', '8']);
    expect(JSON.parse((update.request.body as FormData).get('itemsJson') as string)).toEqual([{ id: 5, producedQuantity: 2 }]);
    update.flush({ ...order, items: [{ ...order.items[0], producedQuantity: 2 }] }); await fixture.whenStable();
  });

  it('keeps unsaved selections after the server rejects a save', async () => {
    await loadAvailable(); checkboxes()[1].click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.linked-checklist-box .linked-checklist-item').length).toBe(1);
    submit();
    http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1')).flush(
      { error: 'A quantidade de equipamentos vinculados excede o limite.' }, { status: 422, statusText: 'Unprocessable Entity' }
    );
    await fixture.whenStable();
    expect(checkboxes()[0].checked).toBeTrue(); expect(checkboxes()[1].checked).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('.linked-checklist-box .linked-checklist-item').length).toBe(1);
    expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeFalse();
    http.expectNone(request => request.method === 'GET');
  });
  it('shows the return button only at PCP and saves pending input together with the return', async () => {
    expect(fixture.nativeElement.querySelector('.return-to-assembly')).toBeNull();
    fixture.componentInstance.open(1);
    const pcpOrder = { ...order, currentStep: 'PCP', nextStep: 'Frete' };
    http.expectOne(request => request.url.endsWith('/step-flow/1')).flush(pcpOrder);
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([checklist]);
    await fixture.whenStable();
    const reload = spyOn(fixture.componentInstance.reloadOrders, 'emit');
    const comment = fixture.nativeElement.querySelector('#comment') as HTMLTextAreaElement;
    comment.value = 'Ajustar montagem'; comment.dispatchEvent(new Event('input')); await fixture.whenStable();
    const buttons = fixture.nativeElement.querySelectorAll('.buttons-container button');
    expect(buttons.length).toBe(3);
    expect(buttons[0].type).toBe('button');
    expect(buttons[0].textContent).toContain('Voltar Etapa');
    expect(buttons[1].textContent).toContain('Cancelar');
    (fixture.nativeElement.querySelector('.return-to-assembly') as HTMLButtonElement).click();
    const update = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1'));
    expect((update.request.body as FormData).get('setStage')).toBe('0');
    expect((update.request.body as FormData).get('comment')).toBe('Ajustar montagem');
    expect((update.request.body as FormData).has('itemsJson')).toBeFalse();
    update.flush(order); await fixture.whenStable();
    expect(reload).toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.sof-custom-offcanvas.visible')).toBeNull();
  });

  it('retains the PCP form when the return fails', async () => {
    fixture.componentInstance.open(1);
    http.expectOne(request => request.url.endsWith('/step-flow/1')).flush({ ...order, currentStep: 'PCP', nextStep: 'Frete' });
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([checklist]);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('.return-to-assembly') as HTMLButtonElement;
    button.click(); await fixture.whenStable();
    expect(button.disabled).toBeTrue();
    http.expectOne(request => request.method === 'PUT').flush({}, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(button.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.sof-custom-offcanvas.visible')).not.toBeNull();
  });

});

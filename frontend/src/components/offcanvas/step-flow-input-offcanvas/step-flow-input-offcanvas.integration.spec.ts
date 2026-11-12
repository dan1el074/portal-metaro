import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { ReprocessStepFlowModalComponent } from '../../modal/step-flow/reprocess-step-flow-modal/reprocess-step-flow-modal.component';
import { StepFlowInputOffcanvasComponent } from './step-flow-input-offcanvas.component';
import { VolumeStepFlowModalComponent } from '../../modal/step-flow/volume-step-flow-modal/volume-step-flow-modal.component';
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
      { provide: BackNavigationService, useValue: jasmine.createSpyObj('BackNavigationService', ['register', 'unregister', 'runAfterOverlayClose']) },
    ] });
    (TestBed.inject(BackNavigationService).runAfterOverlayClose as jasmine.Spy).and.callFake((action: () => void) => action());
    fixture = TestBed.createComponent(StepFlowInputOffcanvasComponent);
    fixture.componentRef.setInput('isAdmin', false); fixture.componentRef.setInput('steps', []);
    http = TestBed.inject(HttpTestingController); fixture.detectChanges();
    fixture.componentInstance.open(1);
    http.expectOne(request => request.url.endsWith('/step-flow/1')).flush(order);
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([checklist]);
    await fixture.whenStable();
  });

  afterEach(() => { fixture.destroy(); http.verify(); });

  it('saves quantity from its modal without submitting pending comments or the step form', async () => {
    const comment = fixture.nativeElement.querySelector('#comment') as HTMLTextAreaElement;
    comment.value = 'Comentário ainda não salvo'; comment.dispatchEvent(new Event('input'));
    (fixture.nativeElement.querySelector('.sof-file-edit-icon') as HTMLButtonElement).click(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('#inputQuantity') as HTMLInputElement;
    input.value = '2'; input.dispatchEvent(new Event('input')); await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(QuantityStepFlowModalComponent));
    (modal.nativeElement.querySelector('c-modal-footer button[color="primary"]') as HTMLButtonElement).click();
    const request = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1/items/5/quantity'));
    expect(request.request.body).toEqual({ producedQuantity: 2 });
    http.expectNone(request => request.url.endsWith('/step-flow/1') || request.url.endsWith('/equipment'));
    request.flush({ ...order.items[0], producedQuantity: 2 }); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.produced-item-quantity').textContent).toContain('2 / 4');
    expect(comment.value).toBe('Comentário ainda não salvo');
    expect(fixture.nativeElement.querySelector('.sof-custom-offcanvas.visible')).not.toBeNull();
    submit();
    const save = http.expectOne(request => request.url.endsWith('/step-flow/1') && request.method === 'PUT');
    expect((save.request.body as FormData).has('itemsJson')).toBeFalse();
    expect((save.request.body as FormData).get('comment')).toBe('Comentário ainda não salvo');
    save.flush({ ...order, items: [{ ...order.items[0], producedQuantity: 2 }] }); await fixture.whenStable();
  });

  it('preserves the entered quantity after an error and only updates the item after success', async () => {
    (fixture.nativeElement.querySelector('.sof-file-edit-icon') as HTMLButtonElement).click(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('#inputQuantity') as HTMLInputElement;
    input.value = '2'; input.dispatchEvent(new Event('input')); await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(QuantityStepFlowModalComponent));
    const save = modal.nativeElement.querySelector('c-modal-footer button[color="primary"]') as HTMLButtonElement;
    save.click(); await fixture.whenStable();
    expect(save.disabled).toBeTrue(); expect(input.value).toBe('2');
    http.expectOne(request => request.url.endsWith('/quantity')).flush({ error: 'Não foi possível salvar.' }, { status: 422, statusText: 'Unprocessable Entity' });
    await fixture.whenStable();
    expect(input.value).toBe('2'); expect(save.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('.produced-item-quantity').textContent).toContain('3 / 4');
    save.click(); http.expectOne(request => request.url.endsWith('/quantity')).flush({ ...order.items[0], producedQuantity: 2 });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.produced-item-quantity').textContent).toContain('2 / 4');
  });

  it('saves volumes from the volume modal and preserves the form if the request fails', async () => {
    (fixture.nativeElement.querySelector('.add-volume-button') as HTMLButtonElement).click(); await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(VolumeStepFlowModalComponent));
    for (const [id, value] of Object.entries({ volumeLength: '1.2', volumeWidth: '0.8', volumeHeight: '0.5', volumeWeight: '12.35', volumeQuantity: '2' })) {
      const input = modal.nativeElement.querySelector('#' + id) as HTMLInputElement; input.value = value; input.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    const save = modal.nativeElement.querySelector('c-modal-footer button[color="primary"]') as HTMLButtonElement;
    save.click(); await fixture.whenStable();
    const request = http.expectOne(request => request.method === 'POST' && request.url.endsWith('/step-flow/1/volumes'));
    expect(request.request.body).toEqual({ id: null, quantity: 2, length: 1.2, width: 0.8, height: 0.5, weight: 12.35 });
    request.flush({}, { status: 503, statusText: 'Service Unavailable' }); await fixture.whenStable();
    expect((modal.nativeElement.querySelector('#volumeWeight') as HTMLInputElement).value).toBe('12.35');
    save.click(); http.expectOne(request => request.url.endsWith('/volumes')).flush({ id: 11, quantity: 2, length: 1.2, width: 0.8, height: 0.5, weight: 12.35 });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.volume-card').length).toBe(1);
    http.expectNone(request => request.method === 'PUT');
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

  it('removes a checklist using the final Save button without resending persisted quantities', async () => {
    const section = fixture.nativeElement.querySelector('.checklist-equipment-box') as HTMLElement;
    (section.querySelector('input[type="checkbox"]') as HTMLInputElement).click(); await fixture.whenStable();
    http.expectNone(request => request.method === 'PUT');
    expect(fixture.nativeElement.querySelectorAll('.linked-checklist-box .linked-checklist-item').length).toBe(1);
    const save = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    save.click();
    const update = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1'));
    expect(JSON.parse((update.request.body as FormData).get('checklistFlowIdsJson') as string)).toEqual([]);
    expect((update.request.body as FormData).has('itemsJson')).toBeFalse();
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

  it('keeps pending checklist selections separate when saving a reduced quantity', async () => {
    await loadAvailable(); checkboxes()[1].click(); checkboxes()[2].click(); await fixture.whenStable();
    (fixture.nativeElement.querySelector('.sof-file-edit-icon') as HTMLButtonElement).click(); await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(QuantityStepFlowModalComponent)).componentInstance as QuantityStepFlowModalComponent;
    modal.save.emit(2);
    http.expectOne(request => request.url.endsWith('/quantity')).flush({ ...order.items[0], producedQuantity: 2 }); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.checklist-count').textContent).toContain('3 de 2');
    expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
    submit(); http.expectNone(request => request.method === 'PUT');
    checkboxes()[2].click(); await fixture.whenStable(); submit();
    const update = http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1'));
    expect(JSON.parse((update.request.body as FormData).get('checklistFlowIdsJson') as string)).toEqual(['7', '8']);
    expect((update.request.body as FormData).has('itemsJson')).toBeFalse();
    update.flush({ ...order, items: [{ ...order.items[0], producedQuantity: 2 }] });
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([{ ...checklist }, { ...checklist, flowId: '8' }]);
    await fixture.whenStable();
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
    expect(fixture.nativeElement.querySelector('.checklist-equipment-box')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.linked-checklist-box .linked-checklist-item').length).toBe(1);
    const reload = spyOn(fixture.componentInstance.reloadOrders, 'emit');
    const comment = fixture.nativeElement.querySelector('#comment') as HTMLTextAreaElement;
    comment.value = 'Ajustar montagem'; comment.dispatchEvent(new Event('input')); await fixture.whenStable();
    const buttons = fixture.nativeElement.querySelectorAll('.buttons-container button');
    expect(buttons.length).toBe(4);
    expect(buttons[0].type).toBe('button');
    expect(buttons[0].textContent).toContain('Voltar Etapa');
    expect(buttons[1].textContent).toContain('Reprocessar');
    expect(buttons[2].textContent).toContain('Cancelar');
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

  it('confirms PCP reprocessing, keeps the form on failure and refreshes the queue after success', async () => {
    fixture.componentInstance.open(1);
    http.expectOne(request => request.url.endsWith('/step-flow/1')).flush({ ...order, currentStep: 'PCP', nextStep: 'Frete' });
    http.expectOne(request => request.url.endsWith('/orders/1/equipment')).flush([checklist]);
    await fixture.whenStable();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('.buttons-container button') as NodeListOf<HTMLButtonElement>);
    expect(buttons.slice(0, 3).map(button => button.textContent?.trim())).toEqual(['Voltar Etapa', 'Reprocessar', 'Cancelar']);
    buttons[1].click(); await fixture.whenStable();
    const modal = fixture.debugElement.query(By.directive(ReprocessStepFlowModalComponent)).componentInstance as ReprocessStepFlowModalComponent;
    expect(modal.visible).toBeTrue();
    http.expectNone(request => request.method === 'PUT');
    modal.close.emit(); await fixture.whenStable();
    expect(modal.visible).toBeFalse();
    http.expectNone(request => request.method === 'PUT');
    buttons[1].click(); await fixture.whenStable();
    modal.confirm.emit(); modal.confirm.emit(); await fixture.whenStable();
    http.expectOne(request => request.method === 'PUT' && request.url.endsWith('/step-flow/1/reprocess'))
      .flush({ message: 'ERP indisponível' }, { status: 503, statusText: 'Service Unavailable' });
    await fixture.whenStable();
    expect(modal.visible).toBeTrue(); expect(modal.processing).toBeFalse();
    expect(fixture.nativeElement.querySelector('.sof-custom-offcanvas.visible')).not.toBeNull();
    const reload = jasmine.createSpy('reload'); fixture.componentInstance.reloadOrders.subscribe(reload);
    modal.confirm.emit();
    http.expectOne(request => request.url.endsWith('/step-flow/1/reprocess')).flush({ ...order, items: [{ ...order.items[0], producedQuantity: 0 }] });
    await fixture.whenStable();
    expect(reload).toHaveBeenCalledOnceWith();
    expect(fixture.nativeElement.querySelector('.sof-custom-offcanvas.visible')).toBeNull();
  });

});

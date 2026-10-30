import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NewStepFlowModalComponent } from './new-step-flow-modal.component';
import { ToastrService } from '../../../../app/services/toast.service';
import { StepFlowOrderInfo } from '../../../../app/interface/step-flow.interface';

describe('Step flow manual quantities and optional checklists', () => {
  let fixture: ComponentFixture<NewStepFlowModalComponent>;
  let http: HttpTestingController;
  let toaster: jasmine.SpyObj<ToastrService>;
  const order = {
    number: 900, client: 'Cliente', cnpj: '123', startDate: '2026-10-29', dueDate: '2026-11-01',
    items: [{ id: 1, code: 42, description: 'Mesa', quantity: 4, producedQuantity: 0, unitPrice: 1, total: 4, unit: 'UN' }],
  };
  const checklists = [{ flowId: '7', recordId: '1', serial: '18918', item: 'Outro nome do ERP', selected: false }];

  beforeEach(() => {
    toaster = jasmine.createSpyObj('ToastrService', ['error', 'warning']);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
      { provide: ToastrService, useValue: toaster },
    ] });
    fixture = TestBed.createComponent(NewStepFlowModalComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('isAdmin', false);
    http = TestBed.inject(HttpTestingController); fixture.detectChanges();
  });

  afterEach(async () => { fixture.destroy(); await new Promise(resolve => setTimeout(resolve, 80)); http.verify(); });

  async function search(equipment = checklists, failChecklists = false): Promise<void> {
    const input = fixture.nativeElement.querySelector('#number') as HTMLInputElement;
    input.value = '900'; input.dispatchEvent(new Event('input')); await fixture.whenStable();
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    http.expectOne(request => request.url.endsWith('/erp/900')).flush(order);
    const available = http.expectOne(request => request.url.endsWith('/available-equipment'));
    if (failChecklists) available.flush({}, { status: 500, statusText: 'Erro' }); else available.flush(equipment);
    await new Promise(resolve => setTimeout(resolve, 520)); await fixture.whenStable();
  }

  function continueButton(): HTMLButtonElement {
    return Array.from(fixture.nativeElement.querySelectorAll('#newStepFlowModal button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.trim() === 'Continuar')!;
  }

  async function quantity(value: number): Promise<void> {
    const input = fixture.nativeElement.querySelector('.search-item-quantity input') as HTMLInputElement;
    input.value = String(value); input.dispatchEvent(new Event('input')); await fixture.whenStable();
  }

  it('shows ERP quantities followed by a separate checklist list and never derives quantity from selected series', async () => {
    await search();
    const items = fixture.nativeElement.querySelector('.search-item-quantity') as HTMLElement;
    const linked = fixture.nativeElement.querySelector('.checklist-item') as HTMLElement;
    expect(items.compareDocumentPosition(linked) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await quantity(3);
    const selected = linked.querySelector('input')!; selected.checked = true; selected.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect((items.querySelector('input') as HTMLInputElement).value).toBe('3');
    const emit = jasmine.createSpy('created'); fixture.componentInstance.createNewOrder.subscribe(emit);
    continueButton().click(); await fixture.whenStable();
    expect(emit).toHaveBeenCalledWith(jasmine.objectContaining({ checklistFlowIds: ['7'], items: [jasmine.objectContaining({ producedQuantity: 3 })] }));
    expect(toaster.error).not.toHaveBeenCalled();
  });

  it('allows an operator to create an order without selecting available checklists', async () => {
    await search(); await quantity(2);
    const emit = jasmine.createSpy('created'); fixture.componentInstance.createNewOrder.subscribe(emit);
    continueButton().click(); await fixture.whenStable();
    expect(emit).toHaveBeenCalledWith(jasmine.objectContaining({ checklistFlowIds: [], items: [jasmine.objectContaining({ producedQuantity: 2 })] }));
  });

  it('allows manual quantities when no checklist is available', async () => {
    await search([]);
    expect(fixture.nativeElement.textContent).toContain('Nenhum checklist finalizado disponível');
    const emit = jasmine.createSpy('created'); fixture.componentInstance.createNewOrder.subscribe(emit);
    continueButton().click(); await fixture.whenStable();
    expect(emit).toHaveBeenCalledWith(jasmine.objectContaining({ checklistFlowIds: [], items: [jasmine.objectContaining({ producedQuantity: 4 })] }));
  });

  it('preserves quantity limits independently of checklist selection', async () => {
    await search(); await quantity(5);
    expect(continueButton().disabled).toBeTrue();
    await quantity(0);
    const emit = jasmine.createSpy('created'); fixture.componentInstance.createNewOrder.subscribe(emit);
    continueButton().click(); await fixture.whenStable();
    expect(emit).not.toHaveBeenCalled(); expect(toaster.error).toHaveBeenCalled();
  });

  it('does not lose ERP quantities when the optional checklist lookup fails', async () => {
    await search([], true);
    expect(toaster.warning).toHaveBeenCalled();
    expect((fixture.nativeElement.querySelector('.search-item-quantity input') as HTMLInputElement).value).toBe('4');
    expect(continueButton().disabled).toBeFalse();
  });
});

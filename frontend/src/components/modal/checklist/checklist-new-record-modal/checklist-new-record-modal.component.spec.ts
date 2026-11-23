import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { ChecklistNewRecordModalComponent } from './checklist-new-record-modal.component';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistCreationOption } from '../../../../app/services/checklist.service';

describe('New checklist serial selection', () => {
  let fixture: ComponentFixture<ChecklistNewRecordModalComponent>;
  let http: HttpTestingController;
  let option: ChecklistCreationOption;
  let portalAdmin: boolean;
  const order = { number: 900, client: 'Cliente', cnpj: '123', salesperson: 'Vendedor', items: [{ code: 'MESA', description: 'Mesa', quantity: 2 }] };

  beforeEach(() => {
    portalAdmin = false;
    option = { id: '2', name: 'Inspeção', categoryId: '1', categoryName: 'Produção',
      integration: 'production', erp: true, serial: true, standalone: true, hasPredecessor: false };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(),
      { provide: ChecklistPreviewService, useValue: {
        get user() { return { roles: [{ authority: portalAdmin ? 'ROLE_ADMIN' : 'ROLE_CHECKLIST_ADMIN' }] }; },
      } },
    ] });
    fixture = TestBed.createComponent(ChecklistNewRecordModalComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    fixture.componentInstance.open([option]);
  });

  afterEach(async () => { fixture.destroy(); http.verify(); await new Promise(resolve => setTimeout(resolve, 80)); });

  async function waitForConfirmation(): Promise<HTMLElement> {
    for (let attempt = 0; attempt < 40; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10)); await fixture.whenStable();
      const modal = fixture.nativeElement.querySelector('app-checklist-action-modal') as HTMLElement;
      if (modal.querySelector('c-modal[aria-modal="true"]')) return modal;
    }
    throw new Error('The serial waiver confirmation was closed unexpectedly');
  }

  // Exercise protected form handlers through their actual bindings and rendered controls.
  function control(label: string): HTMLInputElement | HTMLSelectElement {
    fixture.detectChanges();
    const target = Array.from(fixture.nativeElement.querySelectorAll('label') as NodeListOf<HTMLLabelElement>)
      .find(element => element.textContent?.trim().startsWith(label));
    return target!.querySelector('input, select')!;
  }

  async function change(label: string, value: string): Promise<void> {
    const input = control(label); input.value = value;
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input'));
    await fixture.whenStable();
  }

  it('loads series for the order and selected ERP item code and clears them when the order changes', async () => {
    await change('Pedido', '900');
    control('Pedido').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush(order);
    const available = http.expectOne(request => request.url.endsWith('/available-serials'));
    expect(available.request.params.get('order')).toBe('900');
    expect(available.request.params.get('item')).toBe('MESA');
    available.flush([{ serial: '18918', description: 'Modelo' }]);
    await fixture.whenStable();
    expect(control('Número de série').textContent).toContain('18918');
    await change('Pedido', '901');
    expect(control('Número de série').textContent).not.toContain('18918');
  });

  it('queries each item by its code and clears the previous serial selection when the item changes', async () => {
    await change('Pedido', '900');
    control('Pedido').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush({ ...order, items: [
      { code: '60310', description: 'Mesmo modelo', quantity: 1 },
      { code: '60297', description: 'Mesmo modelo', quantity: 1 },
    ] });
    await fixture.whenStable();
    http.expectNone(request => request.url.endsWith('/available-serials'));
    await change('Item', '60310');
    const first = http.expectOne(request => request.url.endsWith('/available-serials'));
    expect(first.request.params.get('order')).toBe('900'); expect(first.request.params.get('item')).toBe('60310');
    first.flush([{ serial: '18918', description: 'Modelo' }]); await fixture.whenStable();
    await change('Número de série', '18918');
    await change('Item', '60297');
    const second = http.expectOne(request => request.url.endsWith('/available-serials'));
    expect(second.request.params.get('item')).toBe('60297');
    second.flush([{ serial: '18919', description: 'Modelo' }]); await fixture.whenStable();
    expect(control('Número de série').value).toBe('');
    expect(control('Número de série').textContent).not.toContain('18918');
    expect(control('Número de série').textContent).toContain('18919');
  });

  it('disables order and item in PE and submits only the selected stock series', async () => {
    const checkbox = control('Pronta Entrega') as HTMLInputElement;
    checkbox.checked = true; checkbox.dispatchEvent(new Event('change'));
    const available = http.expectOne(request => request.url.endsWith('/available-serials'));
    expect(available.request.params.get('readyStock')).toBe('true');
    available.flush([{ serial: '18919', description: 'Pronta Entrega' }]);
    await fixture.whenStable();
    expect(control('Pedido').disabled).toBeTrue(); expect(control('Item').disabled).toBeTrue();
    await change('Número de série', '18919');
    const emitted = jasmine.createSpy('created'); fixture.componentInstance.createRecord.subscribe(emitted);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Criar checklist')!;
    button.click(); await fixture.whenStable();
    expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ serial: '18919', readyStock: true, order: undefined, item: undefined }));
  });

  it('keeps a checklist administrator from creating an ordinary checklist without a series', async () => {
    await change('Pedido', '900'); control('Pedido').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush(order);
    http.expectOne(request => request.url.endsWith('/available-serials')).flush([]);
    await fixture.whenStable();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Criar checklist')!;
    expect(button.disabled).toBeTrue();
  });

  it('requires portal admin confirmation and allows cancellation without creating the checklist', async () => {
    portalAdmin = true;
    await change('Pedido', '900'); control('Pedido').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush(order);
    http.expectOne(request => request.url.endsWith('/available-serials')).flush([]);
    await fixture.whenStable();
    const emitted = jasmine.createSpy('created'); fixture.componentInstance.createRecord.subscribe(emitted);
    const create = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Criar checklist')!;
    create.click(); await waitForConfirmation(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Este checklist será criado sem um número de série vinculado');
    expect(emitted).not.toHaveBeenCalled();
    const confirmation = await waitForConfirmation();
    const cancel = Array.from(confirmation.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Cancelar')!;
    cancel.click(); await new Promise(resolve => setTimeout(resolve, 350)); await fixture.whenStable(); expect(emitted).not.toHaveBeenCalled();
    const createAgain = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Criar checklist')!;
    createAgain.click(); await new Promise(resolve => setTimeout(resolve, 350)); await fixture.whenStable();
    const confirm = Array.from(confirmation.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Continuar')!;
    confirm.click(); await new Promise(resolve => setTimeout(resolve, 80)); await fixture.whenStable();
    expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ confirmWithoutSerial: true }));
  });

  it('keeps the first serial waiver confirmation open and creates once only after confirmation', async () => {
    portalAdmin = true;
    await change('Pedido', '900'); control('Pedido').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush(order);
    http.expectOne(request => request.url.endsWith('/available-serials')).flush([]);
    await fixture.whenStable();
    const emitted = jasmine.createSpy('created'); fixture.componentInstance.createRecord.subscribe(emitted);
    const create = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Criar checklist')!;
    create.click(); create.click();
    const modal = await waitForConfirmation();
    await new Promise(resolve => setTimeout(resolve, 100)); await fixture.whenStable();
    expect(modal.querySelector('c-modal')?.getAttribute('aria-modal')).toBe('true');
    expect(emitted).not.toHaveBeenCalled();
    const confirm = Array.from(modal.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Continuar')!;
    confirm.click(); await new Promise(resolve => setTimeout(resolve, 80)); await fixture.whenStable();
    expect(emitted).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ confirmWithoutSerial: true, order: '900', item: 'MESA' }));
  });

  it('preserves KIT without series for checklist administrators', async () => {
    option.name = 'KIT';
    await change('Pedido', '900'); control('Pedido').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    http.expectOne(request => request.url.endsWith('/erp/orders/900')).flush(order);
    http.expectOne(request => request.url.endsWith('/available-serials')).flush([]);
    await fixture.whenStable();
    const emitted = jasmine.createSpy('created'); fixture.componentInstance.createRecord.subscribe(emitted);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Criar checklist')!;
    expect(button.disabled).toBeFalse(); button.click(); await fixture.whenStable();
    expect(emitted).toHaveBeenCalledWith(jasmine.objectContaining({ confirmWithoutSerial: false, serial: undefined }));
  });
  it('asks before creating ready stock KIT without a serial and preserves the form when cancelled', async () => {
    option.name = 'KIT';
    await fixture.whenStable();
    (control('Pronta Entrega') as HTMLInputElement).click();
    await fixture.whenStable();
    http.expectOne(request => request.url.endsWith('/available-serials')).flush([]);
    await fixture.whenStable();
    const emitted = jasmine.createSpy('created'); fixture.componentInstance.createRecord.subscribe(emitted);
    const create = () => Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(button => button.textContent?.trim() === 'Criar checklist')!;
    expect(create().disabled).toBeFalse(); create().click();
    let modal = await waitForConfirmation();
    expect(emitted).not.toHaveBeenCalled();
    Array.from(modal.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Cancelar')!.click();
    await new Promise(resolve => setTimeout(resolve, 350)); await fixture.whenStable();
    expect((control('Pronta Entrega') as HTMLInputElement).checked).toBeTrue();
    expect(emitted).not.toHaveBeenCalled();
    create().click(); modal = await waitForConfirmation();
    Array.from(modal.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Continuar')!.click();
    await new Promise(resolve => setTimeout(resolve, 80)); await fixture.whenStable();
    expect(emitted).toHaveBeenCalledOnceWith(jasmine.objectContaining({ readyStock: true, serial: undefined, confirmWithoutSerial: false }));
  });

});

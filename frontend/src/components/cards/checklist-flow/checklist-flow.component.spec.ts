import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChecklistFlowComponent } from './checklist-flow.component';
import { Checklist, Flow } from '../../../app/interface/checklist.interface';

describe('Checklist flow justification label', () => {
  let fixture: ComponentFixture<ChecklistFlowComponent>;
  const flow = {
    id: '1', serial: '18918', order: '900', clientId: '', client: '', item: '', seller: '', cancelled: false,
    plan: [{ template: { id: '2' }, category: { name: 'Montagem Final' }, equipment: '' }], skipped: {},
  } as Flow;
  const record = { id: '3', flowId: '1', templateId: '2', status: 'Cancelado' } as Checklist;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(ChecklistFlowComponent);
    fixture.componentRef.setInput('currentId', '3');
  });
  afterEach(() => fixture.destroy());

  async function render(records: Checklist[], skipped: Record<string, string> = {}): Promise<string> {
    fixture.componentRef.setInput('flow', { ...flow, skipped });
    fixture.componentRef.setInput('records', records);
    fixture.detectChanges(); await fixture.whenStable();
    return fixture.nativeElement.querySelector('.flow-step small').textContent.trim();
  }

  it('displays the persisted justified status with its skip reason', async () => {
    expect(await render([{ ...record, status: 'Justificado' }], { '2': 'Não se aplica a este equipamento' })).toBe('Justificado');
    expect(fixture.nativeElement.querySelector('.skip-reason').textContent).toBe('Não se aplica a este equipamento');
    expect(record.status).toBe('Cancelado');
  });
  it('retains Cancelado when there is no justification', async () => {
    expect(await render([record])).toBe('Cancelado');
  });
  it('retains other record statuses even if a reason exists', async () => {
    expect(await render([{ ...record, status: 'Finalizado' }], { '2': 'Motivo anterior' })).toBe('Finalizado');
  });
  it('preserves the skipped label when no record exists', async () => {
    expect(await render([], { '2': 'Não se aplica' })).toBe('Etapa pulada');
  });
  it('preserves the not generated label when there is no record or reason', async () => {
    expect(await render([])).toBe('Ainda não gerado');
  });
});

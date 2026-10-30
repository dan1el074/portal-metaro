import { TestBed } from '@angular/core/testing';
import { SerialPlatesHistoryModalComponent } from './serial-plates-history-modal.component';

describe('Serial plate history presentation', () => {
  it('formats units, PE and manufacturing month without changing stored audit values', () => {
    const fixture = TestBed.createComponent(SerialPlatesHistoryModalComponent);
    const events = [{ author: 'PCP', at: '2026-10-29T12:00:00Z', changes: [
      { field: 'Capacidade', before: '', after: '6.5' },
      { field: 'Peso', before: '300', after: '550' },
      { field: 'Pronta Entrega', before: 'false', after: 'true' },
      { field: 'Data de fabricação', before: '2025-01', after: '2026-10' },
    ] }];
    const original = JSON.stringify(events);
    fixture.componentRef.setInput('events', events); fixture.detectChanges();
    const lines = Array.from(fixture.nativeElement.querySelectorAll('.history-list li')).map((element: any) => element.textContent);
    expect(lines[0]).toContain('(vazio)'); expect(lines[0]).toContain('6.5 ton');
    expect(lines[1]).toContain('300 kg'); expect(lines[1]).toContain('550 kg');
    expect(lines[2]).toContain('Não'); expect(lines[2]).toContain('Sim');
    expect(lines[3]).toContain('01/2025'); expect(lines[3]).toContain('10/2026');
    expect(JSON.stringify(events)).toBe(original);
    fixture.destroy();
  });
});

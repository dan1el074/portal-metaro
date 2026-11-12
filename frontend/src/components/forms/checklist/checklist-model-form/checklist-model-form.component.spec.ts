import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ChecklistModelFormComponent } from './checklist-model-form.component';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ToastrService } from '../../../../app/services/toast.service';
import { ChecklistState, Template } from '../../../../app/interface/checklist.interface';
import { emptyChecklistCategory, emptyChecklistSection } from '../../../../app/shared/checklist-factory';
import { validateTemplate } from '../../../../app/shared/checklist-rules';

describe('Checklist model requirements', () => {
  let fixture: ComponentFixture<ChecklistModelFormComponent>;
  let data: ChecklistState;
  let toast: jasmine.SpyObj<ToastrService>;
  let model: Template;

  beforeEach(async () => {
    const category = { ...emptyChecklistCategory(), id: 'a', name: 'Inspeção' };
    const section = emptyChecklistSection(true);
    section.name = 'Seção'; section.questions[0].label = 'Pergunta';
    model = { id: '13', categoryId: 'b', name: 'MEB', equipmentId: 'e', title: '%data', sections: [section],
      signature: true, predecessorId: '12', automatic: false, optionalPredecessor: false, version: 1 };
    const previous = { ...model, id: '12', categoryId: 'a', predecessorId: '11' };
    data = { categories: [category, { ...category, id: 'b', name: 'Montagem' }, { ...category, id: 'c', active: false }],
      equipment: [{ id: 'e', name: 'Mesa', abbreviation: 'MEB' }],
      templates: [previous, model, { ...previous, id: '11', categoryId: 'c', predecessorId: '' },
        { ...previous, id: 'other', equipmentId: 'other', predecessorId: '' }],
      schema: 1, records: [], flows: [], items: [], defects: [], processes: [], nokFields: [] };
    toast = jasmine.createSpyObj('ToastrService', ['error']);
    await TestBed.configureTestingModule({ imports: [ChecklistModelFormComponent], providers: [
      { provide: ChecklistPreviewService, useValue: { state: signal(data) } },
      { provide: ToastrService, useValue: toast },
    ] }).compileComponents();
    fixture = TestBed.createComponent(ChecklistModelFormComponent);
    fixture.componentRef.setInput('model', structuredClone(model));
    fixture.detectChanges(); await fixture.whenStable();
  });

  function select(): HTMLSelectElement { return fixture.nativeElement.querySelector('.requirement-field select'); }

  it('shows the stored requirement even when it already has a predecessor and successor', () => {
    expect(select().value).toBe('12');
    expect(Array.from(select().options).map(option => option.value)).toEqual(['', '12', '11']);
  });

  it('rejects an occupied requirement immediately, names its successor and keeps the previous selection', async () => {
    select().value = '11'; select().dispatchEvent(new Event('change'));
    fixture.detectChanges(); await fixture.whenStable();
    expect(toast.error).toHaveBeenCalledWith('Este requisito já tem um sucessor. Bifurcações não são permitidas.\nInspeção - MEB');
    expect(fixture.componentInstance.model.predecessorId).toBe('12');
    expect(select().value).toBe('12');
    expect(validateTemplate({ ...model, predecessorId: '11' }, data)).toContain('\nInspeção - MEB');
  });
});

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ChecklistState, Template } from '../interface/checklist.interface';
import { defaultChecklistNokFields, emptyChecklistCategory, emptyChecklistSection } from '../shared/checklist-factory';
import { ChecklistPreviewService } from './checklist-preview.service';
import { UserService } from './user.service';

describe('ChecklistPreviewService', () => {
  let service: ChecklistPreviewService;
  const user = { id: 999991, name: 'Administrador teste', roles: [{ authority: 'ROLE_CHECKLIST_ADMIN' }] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UserService, useValue: { getCurrentUser: () => user } },
      ],
    });
    service = TestBed.inject(ChecklistPreviewService);
    service.state.set(testState());
  });

  it('identifica permissões administrativas e operacionais', () => {
    expect(service.admin).toBeTrue();
    expect(service.operator).toBeTrue();
  });

  it('mantém o snapshot do fluxo independente das alterações do modelo', () => {
    const template = service.state().templates.find((item) => !item.predecessorId)!;
    const result = service.newRecord(template.id);
    const original = result.flow.plan[0].template.sections[0].questions[0].label;
    service.state().templates.find((item) => item.id === template.id)!.sections[0].questions[0].label = 'Pergunta alterada';
    expect(result.flow.plan[0].template.sections[0].questions[0].label).toBe(original);
  });
});

function testState(): ChecklistState {
  const category = { ...emptyChecklistCategory(), id: 'category', name: 'Production', operators: [999991] };
  const section = emptyChecklistSection(true);
  section.name = 'Inspection';
  section.questions[0].label = 'Original question';
  const template: Template = {
    id: 'template',
    categoryId: category.id,
    name: 'Equipment',
    equipmentId: 'equipment',
    title: '%serie',
    sections: [section],
    signature: true,
    predecessorId: '',
    automatic: false,
    version: 1,
  };
  return {
    schema: 1,
    categories: [category],
    equipment: [{ id: 'equipment', name: 'Equipment', abbreviation: 'EQ' }],
    templates: [template],
    flows: [],
    records: [],
    items: [],
    defects: [],
    nokFields: defaultChecklistNokFields(),
    processes: [],
  };
}

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Category, Equipment, Template } from '../interface/checklist.interface';
import { emptyChecklistCategory, emptyChecklistSection } from '../shared/checklist-factory';
import { ChecklistService } from './checklist.service';

describe('ChecklistService', () => {
  let service: ChecklistService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ChecklistService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('não envia o ID temporário ao criar uma categoria', () => {
    const category: Category = { ...emptyChecklistCategory(), name: 'Produção' };

    service.createCategory(category).subscribe();

    const request = http.expectOne(({ method, url }) => method === 'POST' && url.endsWith('/categories'));
    expect(request.request.body.id).toBeUndefined();
    request.flush({ ...category, id: 1 });
  });

  it('não envia o ID temporário ao criar um equipamento', () => {
    const equipment: Equipment = { id: 'temporary-id', name: 'Equipamento', abbreviation: 'EQ' };

    service.createEquipment(equipment).subscribe();

    const request = http.expectOne(({ method, url }) => method === 'POST' && url.endsWith('/equipment'));
    expect(request.request.body.id).toBeUndefined();
    request.flush({ ...equipment, id: 1 });
  });

  it('não envia o ID temporário ao criar um modelo', () => {
    const template: Template = {
      id: 'temporary-id',
      categoryId: '1',
      name: 'Modelo',
      equipmentId: '',
      title: '%data',
      sections: [emptyChecklistSection(false)],
      signature: true,
      predecessorId: '',
      automatic: false,
      version: 0,
    };

    service.createTemplate(template).subscribe();

    const request = http.expectOne(({ method, url }) => method === 'POST' && url.endsWith('/templates'));
    expect(request.request.body.id).toBeUndefined();
    expect(request.request.body.equipmentId).toBeNull();
    expect(request.request.body.predecessorId).toBeNull();
    request.flush({ ...template, id: 1 });
  });
});

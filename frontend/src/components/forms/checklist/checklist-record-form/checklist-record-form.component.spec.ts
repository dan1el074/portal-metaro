import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChecklistRecordFormComponent } from './checklist-record-form.component';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistMediaPreviewService } from '../../../../app/services/checklist-media-preview.service';
import { PostitionService } from '../../../../app/services/position.service';
import { BackNavigationService } from '../../../../app/services/back-navigation.service';
import { emptyChecklistCategory } from '../../../../app/shared/checklist-factory';

describe('Checklist editable media gallery', () => {
  let fixture: ComponentFixture<ChecklistRecordFormComponent>;
  let record: any;
  let previews: ChecklistMediaPreviewService;
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aV0AAAAASUVORK5CYII=';
  beforeEach(async () => {
    const category = { ...emptyChecklistCategory(), erp: false, serial: false, media: true };
    const flow = { id: 'f', clientId: '', plan: [{ category, template: { id: 't', name: 'Modelo', sections: [] } }] };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
      { provide: ChecklistPreviewService, useValue: { state: () => ({ records: [], nokFields: [], items: [], defects: [] }), flow: () => flow } },
      { provide: PostitionService, useValue: { list: () => of([]), findAll: () => of([]) } },
      { provide: BackNavigationService, useValue: jasmine.createSpyObj('BackNavigationService', ['register', 'unregister']) },
    ] });
    fixture = TestBed.createComponent(ChecklistRecordFormComponent);
    previews = TestBed.inject(ChecklistMediaPreviewService);
    record = { id: '1', templateId: 't', fields: {}, answers: {}, departments: [], media: [
      { id: 'one', name: 'Primeira.png', type: 'image/png', dataUrl: pixel },
      { id: 'two', name: 'Segunda.png', type: 'image/png', dataUrl: pixel },
    ] };
    fixture.componentRef.setInput('record', record); fixture.componentRef.setInput('flow', flow);
    fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => { record.media.forEach((item: any) => previews.remove(item.id)); fixture.destroy(); });

  it('removes the selected attachment directly from the gallery and refreshes the remaining previews', async () => {
    expect(fixture.nativeElement.querySelector('.media-file-list')).toBeNull();
    const figures = fixture.nativeElement.querySelectorAll('.editable-gallery figure');
    expect(figures.length).toBe(2);
    expect(figures[0].querySelector('figcaption').textContent).toBe('Primeira.png');
    const changed = spyOn(fixture.componentInstance.changed, 'emit');
    (figures[0].querySelector('.evidence-remove') as HTMLButtonElement).click(); await fixture.whenStable();
    expect(record.media.map((item: any) => item.id)).toEqual(['two']);
    expect(fixture.nativeElement.querySelectorAll('.editable-gallery figure').length).toBe(1);
    expect(fixture.nativeElement.querySelector('figcaption').textContent).toBe('Segunda.png');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('shows newly selected files immediately and allows removal before saving', async () => {
    const input = fixture.nativeElement.querySelector('.media-input') as HTMLInputElement;
    const file = new File(['image'], 'Nova.png', { type: 'image/png' });
    const files = new DataTransfer(); files.items.add(file); input.files = files.files;
    input.dispatchEvent(new Event('change')); await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.editable-gallery figure').length).toBe(3);
    const id = record.media[2].id;
    expect(previews.getFile(id)).toBe(file);
    (fixture.nativeElement.querySelector('button[aria-label="Excluir Nova.png"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.editable-gallery figure').length).toBe(2);
    expect(previews.getFile(id)).toBeUndefined();
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { UserService } from '../../../services/user.service';
import { ChecklistMediaPreviewService } from '../../../services/checklist-media-preview.service';
import { ChecklistComponent } from './checklist.component';

describe('Checklist listing requests', () => {
  it('loads the header, tab counts and first page without preloading management data', () => {
    TestBed.configureTestingModule({
      imports: [ChecklistComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UserService, useValue: { getCurrentUser: () => ({ roles: [{ authority: 'ROLE_CHECKLIST_ADMIN' }] }) } },
        { provide: ChecklistMediaPreviewService, useValue: {} },
      ],
    }).overrideComponent(ChecklistComponent, { set: { template: '', imports: [] } });

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ChecklistComponent);
    fixture.detectChanges();

    http.expectOne(request => request.url.endsWith('/records/counts')).flush({ '1': 12 });
    http.expectOne(request => request.url.endsWith('/header')).flush({
      categories: [{ id: 1, name: 'Montagem/Solda' }],
      headerCount: [{ categories: 1, models: 2, equipment: 3 }],
    });
    http.expectOne(request => request.url.endsWith('/records/table')
      && request.params.get('categoryId') === '1' && request.params.get('page') === '0')
      .flush({ content: [], totalElements: 12, totalPages: 2 });
    http.verify();

    fixture.componentInstance['changePage'](2);
    http.expectOne(request => request.url.endsWith('/records/table') && request.params.get('page') === '1')
      .flush({ content: [], totalElements: 12, totalPages: 2 });
    http.verify();
  });
});

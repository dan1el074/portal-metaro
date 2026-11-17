import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ChecklistDelegateModalComponent } from './checklist-delegate-modal.component';
import { ChecklistService } from '../../../../app/services/checklist.service';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { BackNavigationService } from '../../../../app/services/back-navigation.service';

describe('Checklist delegation operator selection', () => {
  let fixture: ComponentFixture<ChecklistDelegateModalComponent>;
  let store: any;
  let api: any;

  beforeEach(() => {
    api = { listOperators: jasmine.createSpy().and.returnValue(of([
      { id: 1, name: 'Autorizado', activated: true },
      { id: 2, name: 'Inativo', activated: false },
      { id: 3, name: 'Sem acesso à categoria', activated: true },
    ])) };
    store = { state: () => ({ categories: [{ id: 'c', operators: [1, 2] }] }), delegate: jasmine.createSpy().and.resolveTo() };
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(),
      { provide: ChecklistService, useValue: api }, { provide: ChecklistPreviewService, useValue: store },
      { provide: BackNavigationService, useValue: jasmine.createSpyObj('BackNavigationService', ['register', 'unregister']) },
    ] });
    fixture = TestBed.createComponent(ChecklistDelegateModalComponent); fixture.detectChanges();
  });
  afterEach(() => fixture.destroy());

  it('loads operators from the checklist API and filters inactive or unauthorized users', () => {
    fixture.componentInstance.open('1', 'c', null); fixture.detectChanges();
    expect(api.listOperators).toHaveBeenCalledOnceWith();
    const options = fixture.nativeElement.querySelectorAll('select option');
    expect(options.length).toBe(2); expect(options[1].textContent).toContain('Autorizado');
  });

  it('saves the selected operator and emits the refresh only after successful delegation', async () => {
    fixture.componentInstance.open('1', 'c', null); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.selectedIndex = 1; select.dispatchEvent(new Event('change')); fixture.detectChanges();
    const emitted = spyOn(fixture.componentInstance.delegated, 'emit');
    await (fixture.componentInstance as any).save();
    expect(store.delegate).toHaveBeenCalledOnceWith('1', 1); expect(emitted).toHaveBeenCalledTimes(1);
  });
});

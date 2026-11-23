import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalComponent } from '@coreui/angular';
import { RawMaterialsService } from '../../../services/raw-materials.service';
import { UserService } from '../../../services/user.service';
import { ErrorService } from '../../../services/error.service';
import { ToastrService } from '../../../services/toast.service';
import { RawMaterialsComponent } from './raw-materials.component';

describe('RawMaterialsComponent modal transitions', () => {
  let fixture: ComponentFixture<RawMaterialsComponent>;
  let state: any;
  let itemModal: ModalComponent;
  let confirmation: ModalComponent;
  let confirmationElement: HTMLElement;

  function settle(): void {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      tick();
    }
  }

  function openConfirmation(): void {
    const checkbox = fixture.nativeElement.querySelector('.active-control input') as HTMLInputElement;
    checkbox.click();
    settle();
    expect(itemModal.visible()).toBeFalse();
    expect(confirmation.visible()).toBeTrue();
    const reason = confirmationElement.querySelector('textarea')!;
    reason.value = 'Registro duplicado';
    reason.dispatchEvent(new Event('input'));
    settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RawMaterialsComponent],
      providers: [
        { provide: RawMaterialsService, useValue: {} },
        { provide: UserService, useValue: { getCurrentUser: () => ({ name: 'Admin' }) } },
        { provide: ErrorService, useValue: {} },
        { provide: ToastrService, useValue: {} },
      ],
    }).compileComponents();
    // Keep the real navigation service and directives, including asynchronous popstate.
    spyOn(history, 'pushState').and.stub();
    spyOn(history, 'back').and.callFake(() => {
      setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate')));
    });
    fixture = TestBed.createComponent(RawMaterialsComponent);
    spyOn(fixture.componentInstance, 'ngOnInit').and.stub();
    state = fixture.componentInstance;
  });

  beforeEach(fakeAsync(() => {
    state.isAdmin = true;
    state.currentView = 'admin';
    state.openItemModal({ id: 1, code: '13298', name: 'Materia-prima', active: true });
    settle();
    const modals = fixture.debugElement.queryAll(By.directive(ModalComponent));
    itemModal = modals[0].componentInstance;
    confirmation = modals[1].componentInstance;
    confirmationElement = modals[1].nativeElement;
  }));

  for (const action of ['X', 'Cancelar', 'Confirmar', 'Voltar']) {
    it(`returns to the populated item after ${action}, including on repeated transitions`, fakeAsync(() => {
      const item = state.editingItem;
      for (let attempt = 0; attempt < 2; attempt++) {
        openConfirmation();
        if (action === 'Voltar') {
          history.back();
        } else {
          const button = action === 'X'
            ? confirmationElement.querySelector('button[cButtonClose]')!
            : Array.from(confirmationElement.querySelectorAll('button'))
              .find(element => element.textContent?.trim() === action)!;
          (button as HTMLButtonElement).click();
        }
        settle();
        expect(confirmation.visible()).toBeFalse();
        expect(itemModal.visible()).toBeTrue();
        expect(state.editingItem).toBe(item);
        expect(item.active).toBe(action !== 'Confirmar');
        expect(state.deactivationReason).toBe('Registro duplicado');
        item.active = true;
        settle();
      }
      state.closeItemModal();
      settle();
    }));
  }
});

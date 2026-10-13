import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { Subscription } from 'rxjs';
import { UserMinData } from '../../../../app/interface/user.interface';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { UserService } from '../../../../app/services/user.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

@Component({
  selector: 'app-checklist-delegate-modal',
  imports: [CommonModule, FormsModule, ButtonCloseDirective, ButtonDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective],
  templateUrl: './checklist-delegate-modal.component.html',
  styleUrl: './checklist-delegate-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistDelegateModalComponent implements OnDestroy {
  @Output() readonly delegated = new EventEmitter<void>();
  protected visible = false;
  protected loading = false;
  protected saving = false;
  protected error = '';
  protected operators: UserMinData[] = [];
  protected userId: number | null = null;
  private recordId = '';
  private categoryId = '';
  private subscription?: Subscription;

  constructor(
    private readonly store: ChecklistPreviewService,
    private readonly users: UserService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  public open(recordId: string, categoryId: string, ownerId: number | null): void {
    this.recordId = recordId;
    this.categoryId = categoryId;
    this.userId = ownerId;
    this.visible = true;
    this.loading = true;
    this.error = '';
    this.subscription?.unsubscribe();
    this.subscription = this.users.findAll().subscribe({
      next: (users: UserMinData[]) => {
        const allowed = this.store.state().categories.find((category) => category.id === this.categoryId)?.operators ?? [];
        this.operators = users.filter((user) => user.activated && allowed.includes(user.id));
        if (this.userId !== null && !this.operators.some((user) => user.id === this.userId)) this.userId = null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Não foi possível carregar os operadores disponíveis.';
        this.cdr.detectChanges();
      },
    });
    this.cdr.detectChanges();
  }

  protected close(): void {
    if (this.saving) return;
    this.visible = false;
    this.cdr.detectChanges();
  }

  protected async save(): Promise<void> {
    if (this.userId === null || this.saving) return;
    this.saving = true;
    this.error = '';
    try {
      await this.store.delegate(this.recordId, this.userId);
      this.visible = false;
      this.delegated.emit();
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Não foi possível delegar o checklist.';
    } finally {
      this.saving = false;
      this.cdr.detectChanges();
    }
  }
}

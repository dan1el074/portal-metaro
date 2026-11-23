import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { forkJoin, Subscription } from 'rxjs';
import { ChecklistCategoryAccess, ChecklistOperator, ChecklistService } from '../../../../app/services/checklist.service';
import { ToastrService } from '../../../../app/services/toast.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

@Component({ selector: 'app-checklist-access-modal', imports: [CommonModule, ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective], templateUrl: './checklist-access-modal.component.html', styleUrl: './checklist-access-modal.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistAccessModalComponent implements OnDestroy {
  protected visible = false;
  protected loading = false;
  protected saving = false;
  protected error = '';
  protected readonly changes = new Map<string, Map<number, boolean>>();
  protected operators: ChecklistOperator[] = [];
  protected categories: ChecklistCategoryAccess[] = [];
  private subscription?: Subscription;
  private saveRequest?: Subscription;

  constructor(private api: ChecklistService, private cdr: ChangeDetectorRef, private toaster: ToastrService) {}
  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.saveRequest?.unsubscribe();
  }

  public open(): void {
    if (this.saving) return;
    this.changes.clear();
    this.visible = true;
    this.loading = true;
    this.error = '';
    this.operators = [];
    this.categories = [];
    this.subscription?.unsubscribe();
    this.subscription = forkJoin({
      operators: this.api.listOperators(),
      categories: this.api.listCategoryAccess(),
    }).subscribe({
      next: ({ operators, categories }) => {
        this.operators = operators;
        this.categories = categories;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.error = 'Não foi possível carregar o controle de acesso.';
        this.cdr.markForCheck();
      },
    });
    this.cdr.markForCheck();
  }

  protected close(): void { this.visible = false; this.cdr.markForCheck(); }

  protected isAllowed(category: ChecklistCategoryAccess, userId: number): boolean {
    return this.changes.get(category.id)?.get(userId) ?? category.operators.includes(userId);
  }

  protected toggle(category: ChecklistCategoryAccess, userId: number, event: Event): void {
    if (this.saving) return;
    const allowed = (event.target as HTMLInputElement).checked;
    const categoryChanges = this.changes.get(category.id) ?? new Map<number, boolean>();
    if (allowed === category.operators.includes(userId)) categoryChanges.delete(userId);
    else categoryChanges.set(userId, allowed);
    if (categoryChanges.size) this.changes.set(category.id, categoryChanges);
    else this.changes.delete(category.id);
    this.error = '';
  }

  protected save(): void {
    if (this.saving || !this.changes.size) return;
    const changes = [...this.changes].flatMap(([categoryId, users]) =>
      [...users].map(([userId, allowed]) => ({ categoryId, userId, allowed })));
    this.saving = true;
    this.error = '';
    this.saveRequest = this.api.updateAccessBatch(changes).subscribe({
      next: () => {
        for (const category of this.categories) {
          for (const [userId, allowed] of this.changes.get(category.id) ?? []) {
            category.operators = allowed
              ? [...category.operators, userId]
              : category.operators.filter(id => id !== userId);
          }
        }
        this.changes.clear();
        this.saving = false;
        this.toaster.success('Alterações salvas.');
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Não foi possível salvar as alterações de acesso. Tente novamente.';
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { Subscription } from 'rxjs';
import { checklistCopy as copy } from '../../../../app/shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistOperator, ChecklistService } from '../../../../app/services/checklist.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

@Component({ selector: 'app-checklist-access-modal', imports: [CommonModule, ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective], templateUrl: './checklist-access-modal.component.html', styleUrl: './checklist-access-modal.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistAccessModalComponent implements OnDestroy {
  protected visible = false; protected loading = false; protected error = ''; protected operators: ChecklistOperator[] = [];
  private subscription?: Subscription;
  constructor(protected store: ChecklistPreviewService, private api: ChecklistService, private cdr: ChangeDetectorRef) {}
  ngOnDestroy(): void { this.subscription?.unsubscribe(); }
  public open(): void { this.visible = true; this.loading = true; this.error = ''; this.subscription?.unsubscribe(); this.subscription = this.api.listOperators().subscribe({ next: users => { this.operators = users; this.loading = false; this.cdr.detectChanges(); }, error: () => { this.loading = false; this.error = 'Não foi possível listar os operadores.'; this.cdr.detectChanges(); } }); this.cdr.detectChanges(); }
  protected close(): void { this.visible = false; this.cdr.detectChanges(); }
  protected toggle(categoryId: string, userId: number): void { const data = copy(this.store.state()); const category = data.categories.find(item => item.id === categoryId)!; category.operators = category.operators.includes(userId) ? category.operators.filter(id => id !== userId) : [...category.operators, userId]; this.store.commit(data); }
}

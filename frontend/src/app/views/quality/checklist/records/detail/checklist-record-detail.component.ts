import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ContainerComponent, FormControlDirective, TooltipDirective } from '@coreui/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Checklist, Comment, Problem } from '../../../../../interface/checklist.interface';
import { ChecklistPreviewService } from '../../../../../services/checklist-preview.service';
import { ToastrService } from '../../../../../services/toast.service';
import { ChecklistIconComponent } from '../../../../../../components/icons/checklist-icon/checklist-icon.component';
import { ChecklistFlowComponent } from '../../../../../../components/cards/checklist-flow/checklist-flow.component';
import { ChecklistActionModalComponent } from '../../../../../../components/modal/checklist/checklist-action-modal/checklist-action-modal.component';
import { ChecklistClientHistoryComponent } from '../../../../../../components/offcanvas/checklist-client-history/checklist-client-history.component';
import { ChecklistUpdateOrderModalComponent } from '../../../../../../components/modal/checklist/checklist-update-order-modal/checklist-update-order-modal.component';
import { ChecklistEvidenceComponent } from '../../../../../../components/cards/checklist-evidence/checklist-evidence.component';
import { ChecklistDelegateModalComponent } from '../../../../../../components/modal/checklist/checklist-delegate-modal/checklist-delegate-modal.component';
import { ChecklistLinkedStepFlow, ChecklistService } from '../../../../../services/checklist.service';

@Component({
  selector: 'app-checklist-record-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ContainerComponent,
    FormControlDirective,
    TooltipDirective,
    ChecklistIconComponent,
    ChecklistFlowComponent,
    ChecklistActionModalComponent,
    ChecklistClientHistoryComponent,
    ChecklistUpdateOrderModalComponent,
    ChecklistEvidenceComponent,
    ChecklistDelegateModalComponent,
  ],
  templateUrl: './checklist-record-detail.component.html',
  styleUrl: './checklist-record-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistRecordDetailComponent implements OnInit {
  @ViewChild(ChecklistActionModalComponent)
  private actionModal!: ChecklistActionModalComponent;
  @ViewChild(ChecklistClientHistoryComponent)
  private history!: ChecklistClientHistoryComponent;
  @ViewChild(ChecklistDelegateModalComponent)
  private delegateModal!: ChecklistDelegateModalComponent;

  protected readonly store = inject(ChecklistPreviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toaster = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly checklistApi = inject(ChecklistService);
  private recordId = '';
  protected record!: Checklist;
  protected commentText = '';
  protected linkedStepFlows: ChecklistLinkedStepFlow[] = [];

  async ngOnInit(): Promise<void> {
    await this.store.load();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.recordId = params.get('id') ?? '';
      this.commentText = '';
      this.load();
      this.cdr.markForCheck();
    });
  }

  private load(): void {
    const record = this.store.state().records.find((item) => item.id === this.recordId);

    if (!record || !this.store.visible(record)) {
      void this.router.navigate(['/qualidade/checklist']);
      return;
    }
    this.record = record;
    this.loadLinkedStepFlows(record.flowId);
  }

  protected get flow() {
    return this.store.flow(this.record);
  }

  protected get snapshot() {
    return this.store.snapshot(this.record);
  }

  protected get problems() {
    return Object.values(this.record.answers).flatMap((answer) => answer.problems);
  }

  protected problemNumber(problemId?: string): number | null {
    if (!problemId) return null;
    const index = this.problems.findIndex((problem) => problem.id === problemId);
    return index >= 0 ? index + 1 : null;
  }

  protected canEditComment(comment: Comment): boolean {
    return this.store.admin || comment.authorId === this.store.user.id;
  }

  protected get canTreat(): boolean {
    return (
      this.record.status === 'Pendente' &&
      (this.store.admin ||
        (this.store.operator && this.record.finisherId === this.store.user.id))
    );
  }

  private loadLinkedStepFlows(flowId: string): void {
    this.linkedStepFlows = [];
    this.checklistApi.listLinkedStepFlows(flowId).subscribe({
      next: (items) => {
        if (this.record?.flowId !== flowId) return;
        this.linkedStepFlows = items;
        this.cdr.markForCheck();
      },
      error: () => {
        if (this.record?.flowId !== flowId) return;
        this.linkedStepFlows = [];
        this.cdr.markForCheck();
      },
    });
  }

  protected get visibleRecords(): Checklist[] {
    return this.store.state().records.filter((item) => this.store.visible(item));
  }

  protected get previousId(): string | null {
    const index = this.visibleRecords.findIndex(
      (item) => item.id === this.record.id,
    );
    return index > 0 ? this.visibleRecords[index - 1].id : null;
  }

  protected get nextId(): string | null {
    const index = this.visibleRecords.findIndex(
      (item) => item.id === this.record.id,
    );

    return index >= 0 && index < this.visibleRecords.length - 1 ? this.visibleRecords[index + 1].id : null;
  }

  protected get statusClass(): string {
    return this.record.status === 'Rascunho'
      ? 'draft'
      : this.record.status === 'Finalizado'
        ? 'approved'
        : this.record.status === 'Pendente'
          ? 'pending'
          : this.record.status === 'Cancelado'
            ? 'canceled'
            : 'active';
  }

  protected open(id: string): void {
    void this.router.navigate(['/qualidade/checklist', id]);
  }

  protected edit(): void {
    void this.router.navigate(['/qualidade/checklist', this.record.id, 'edit']);
  }

  protected print(): void {
    document.body.classList.add('printing-quality-checklist');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-quality-checklist');
    });
  }

  protected async treat(problem: Problem): Promise<void> {
    const reason = await this.actionModal.open({
      title: 'Marcar NOK como tratado',
      message: `Informe como a ocorrência “${problem.item} · ${problem.code}” foi resolvida.`,
      inputLabel: 'Justificativa',
      required: true,
      confirmLabel: 'Marcar como tratado',
    });

    if (!reason) return;

    try {
      await this.store.treat(this.record.id, problem.id, reason);
      this.load();
      this.toaster.success('Ocorrência tratada.');
      this.cdr.detectChanges();
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Tratamento não permitido.');
    }
  }

  protected async addComment(): Promise<void> {
    const text = this.commentText.trim();

    if (!text) return;

    await this.store.addComment(this.record.id, text);
    this.commentText = '';
    this.load();
    this.cdr.detectChanges();
  }

  protected async editComment(comment: Comment): Promise<void> {
    const text = await this.actionModal.open({
      title: 'Editar comentário',
      message: 'Atualize o texto do comentário.',
      inputLabel: 'Comentário',
      inputValue: comment.text,
      required: true,
      confirmLabel: 'Salvar',
    });

    if (!text) return;

    await this.store.updateComment(this.record.id, comment.id, text);
    this.load();
    this.cdr.detectChanges();
  }

  protected async deleteComment(comment: Comment): Promise<void> {
    const ok = await this.actionModal.open({
      title: 'Excluir comentário',
      message: 'O comentário será removido do histórico visível.',
      danger: true,
      confirmLabel: 'Excluir',
    });

    if (!ok) return;

    await this.store.deleteComment(this.record.id, comment.id);
    this.load();
    this.cdr.detectChanges();
  }

  protected async reopen(): Promise<void> {
    const reason = await this.actionModal.open({
      title: 'Voltar para edição',
      message:
        'As etapas dependentes ficarão bloqueadas para novos avanços até a nova finalização.',
      inputLabel: 'Justificativa',
      required: true,
      confirmLabel: 'Voltar para edição',
    });

    if (!reason) return;

    try {
      await this.store.reopen(this.record.id, reason);
      this.load();
      this.toaster.success('Checklist liberado para edição.');
      this.cdr.detectChanges();
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível reabrir.');
    }
  }

  protected delegate(): void {
    this.delegateModal.open(this.record.id, this.snapshot.category.id, this.record.ownerId);
  }

  protected async updateSerial(): Promise<void> {
    const serial = await this.actionModal.open({
      title: 'Corrigir número de série',
      message: 'A correção será aplicada a todo o fluxo e registrada no histórico.',
      inputLabel: 'Número de série',
      inputValue: this.flow.serial,
      required: true,
      confirmLabel: 'Salvar série',
    });

    if (!serial || serial.trim() === this.flow.serial) return;

    try {
      await this.store.updateSerial(this.record.id, serial);
      this.load();
      this.toaster.success('Número de série atualizado em todo o fluxo.');
      this.cdr.detectChanges();
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível corrigir a série.');
    }
  }

  protected delegated(): void {
    this.load();
    this.toaster.success('Checklist delegado.');
    this.cdr.detectChanges();
  }

  protected async deleteDraft(): Promise<void> {
    const ok = await this.actionModal.open({
      title: 'Excluir rascunho',
      message: 'Este rascunho será excluído definitivamente.',
      danger: true,
      confirmLabel: 'Excluir',
    });

    if (!ok) return;

    await this.store.deleteDraft(this.record.id);
    void this.router.navigate(['/qualidade/checklist']);
  }

  protected async cancelFlow(): Promise<void> {
    const reason = await this.actionModal.open({
      title: 'Cancelar fluxo',
      message: 'Todos os checklists deste fluxo deixarão de ser considerados. Um fluxo cancelado não pode ser reaberto.',
      inputLabel: 'Justificativa',
      required: true,
      danger: true,
      confirmLabel: 'Cancelar fluxo',
    });

    if (!reason) return;

    await this.store.cancelFlow(this.record.id, reason);
    this.load();
    this.cdr.detectChanges();
  }

  protected orderUpdated(): void {
    this.load();
    this.toaster.success('Pedido, cliente e item atualizados em todo o fluxo.');
    this.cdr.detectChanges();
  }
}

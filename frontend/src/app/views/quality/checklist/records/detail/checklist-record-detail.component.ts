import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ContainerComponent, FormControlDirective, SpinnerComponent, TabDirective, TabsComponent, TabsListComponent, TooltipDirective } from '@coreui/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Checklist, Comment, Problem, Status } from '../../../../../interface/checklist.interface';
import { ChecklistPreviewService } from '../../../../../services/checklist-preview.service';
import { ToastrService } from '../../../../../services/toast.service';
import { ChecklistIconComponent } from '../../../../../../components/icons/checklist-icon/checklist-icon.component';
import { ChecklistActionModalComponent } from '../../../../../../components/modal/checklist/checklist-action-modal/checklist-action-modal.component';
import { ChecklistClientHistoryComponent } from '../../../../../../components/offcanvas/checklist-client-history/checklist-client-history.component';
import { ChecklistUpdateOrderModalComponent } from '../../../../../../components/modal/checklist/checklist-update-order-modal/checklist-update-order-modal.component';
import { ChecklistEvidenceComponent } from '../../../../../../components/cards/checklist-evidence/checklist-evidence.component';
import { ChecklistDelegateModalComponent } from '../../../../../../components/modal/checklist/checklist-delegate-modal/checklist-delegate-modal.component';
import { ChecklistLinkedStepFlow, ChecklistMemorando, ChecklistRecordContext, ChecklistService } from '../../../../../services/checklist.service';
import { isProductionKit, recordTitle } from '../../../../../shared/checklist-rules';
import { ReportPreviewService } from '../../../../../services/report-preview.service';
import { firstValueFrom } from 'rxjs';
import { BackNavigationService } from '../../../../../services/back-navigation.service';

@Component({
  selector: 'app-checklist-record-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ContainerComponent,
    FormControlDirective,
    SpinnerComponent,
    TooltipDirective,
    TabsComponent,
    TabsListComponent,
    TabDirective,
    ChecklistIconComponent,
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
  @ViewChild('printArea', { read: ElementRef })
  private printArea!: ElementRef<HTMLElement>;
  protected readonly store = inject(ChecklistPreviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toaster = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly checklistApi = inject(ChecklistService);
  private readonly reportPreview = inject(ReportPreviewService);
  private readonly backNavigation = inject(BackNavigationService);
  private recordId = '';
  private loadVersion = 0;
  protected context!: ChecklistRecordContext;
  protected loading = true;
  protected loadError = '';
  protected deleting = false;
  protected record!: Checklist;
  protected commentText = '';
  protected linkedStepFlows: ChecklistLinkedStepFlow[] = [];
  protected relatedMemorandos: ChecklistMemorando[] = [];
  protected memorandosError = false;
  private memorandosRequest = 0;
  protected readonly memorandoStatuses = { CREATED: 'Rascunho', PUBLISH: 'Publicado', APPROVED: 'Aprovado', CANCELED: 'Cancelado' };

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.recordId = params.get('id') ?? '';
      this.commentText = '';
      void this.loadContext(this.recordId);
    });
  }

  private async loadContext(id: string): Promise<void> {
    const version = ++this.loadVersion;
    this.loading = true;
    this.loadError = '';
    this.cdr.markForCheck();
    try {
      const context = await this.store.loadRecordContext(id);
      if (version !== this.loadVersion || this.destroyRef.destroyed) return;
      if (!this.store.visible(context.record)) {
        void this.router.navigate(['/qualidade/checklist']);
        return;
      }
      const linked = await firstValueFrom(this.checklistApi.listLinkedStepFlows(context.flow.id)
        .pipe(takeUntilDestroyed(this.destroyRef)));
      if (version !== this.loadVersion || this.destroyRef.destroyed) return;
      this.context = context;
      this.record = context.record;
      this.linkedStepFlows = linked;
      this.loadRelatedMemorandos();
    } catch {
      if (version === this.loadVersion) this.loadError = 'Não foi possível carregar o checklist. Tente novamente.';
    } finally {
      if (version === this.loadVersion && !this.destroyRef.destroyed) {
        this.loading = false;
        this.cdr.markForCheck();
      }
    }
  }

  protected retryLoad(): void {
    void this.loadContext(this.recordId);
  }

  private load(): void {
    const record = this.store.state().records.find((item) => item.id === this.recordId);

    if (!record || !this.store.visible(record)) {
      void this.router.navigate(['/qualidade/checklist']);
      return;
    }
    this.record = record;
  }

  protected loadRelatedMemorandos(): void {
    const id = this.record.id;
    const version = this.loadVersion;
    const request = ++this.memorandosRequest;
    this.relatedMemorandos = [];
    this.memorandosError = false;
    if (!this.flow.order || !this.flow.item) return;
    this.checklistApi.listRelatedMemorandos(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        if (version !== this.loadVersion || request !== this.memorandosRequest) return;
        this.relatedMemorandos = items;
        this.cdr.markForCheck();
      },
      error: () => {
        if (version !== this.loadVersion || request !== this.memorandosRequest) return;
        this.memorandosError = true;
        this.cdr.markForCheck();
      },
    });
  }

  protected get flow() {
    return this.context.flow;
  }

  protected get snapshot() {
    return this.flow.plan[0];
  }

  protected get title(): string {
    return recordTitle(this.record, this.flow);
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

  protected get previousId(): string | null {
    return this.context.previousId;
  }

  protected get nextId(): string | null {
    return this.context.nextId;
  }

  protected get statusClass(): string {
    return this.statusTone(this.record.status);
  }

  private statusTone(status: Status | undefined): string {
    return status === 'Rascunho'
      ? 'draft'
      : status === 'Finalizado'
        ? 'approved'
        : status === 'Pendente'
          ? 'pending'
          : status === 'Justificado'
            ? 'justified'
          : status === 'Cancelado'
            ? 'canceled'
            : 'active';
  }

  protected get skipReason(): string {
    return this.flow.skipped[this.record.templateId] ?? '';
  }

  protected get navigationSteps() {
    return this.context.steps.map(step => ({
      ...step,
      recordId: step.recordId ?? '',
      current: step.recordId === this.record.id,
      status: step.status ?? (step.skipped ? 'Etapa pulada' : 'Ainda não gerado'),
      tone: step.status ? this.statusTone(step.status) : step.skipped ? 'justified' : 'draft',
    }));
  }

  protected open(id: string): void {
    void this.router.navigate(['/qualidade/checklist', id]);
  }

  protected selectStep(key: string | number | undefined): void {
    const step = this.navigationSteps.find(item => item.templateId === key);
    if (step?.recordId && !step.current) this.open(step.recordId);
  }

  protected edit(): void {
    void this.router.navigate(['/qualidade/checklist', this.record.id, 'edit']);
  }

  protected print(): void {
    try {
      const opened = this.reportPreview.openElement(this.printArea.nativeElement, `Checklist · ${this.title}`);
      if (!opened) this.toaster.warning('Permita a abertura da aba de visualização no navegador.');
    } catch (error) {
      console.error('Falha ao gerar a prévia do checklist', error);
      this.toaster.warning('Não foi possível gerar a prévia do checklist.');
    }
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
      await this.loadContext(this.recordId);
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
      await this.loadContext(this.recordId);
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
      required: !isProductionKit(this.snapshot),
      confirmLabel: 'Salvar série',
    });

    if (serial === null || serial.trim() === this.flow.serial) return;

    try {
      await this.store.updateSerial(this.record.id, serial);
      await this.loadContext(this.recordId);
      this.toaster.success('Número de série atualizado em todo o fluxo.');
      this.cdr.detectChanges();
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível corrigir a série.');
    }
  }

  protected async delegated(): Promise<void> {
    await this.loadContext(this.recordId);
    this.toaster.success('Checklist delegado.');
    this.cdr.detectChanges();
  }

  protected async deleteDraft(): Promise<void> {
    if (this.deleting) return;
    const ok = await this.actionModal.open({
      title: 'Excluir rascunho',
      message: 'Este rascunho será excluído definitivamente.',
      danger: true,
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        this.deleting = true;
        this.cdr.markForCheck();
        try {
          await this.store.deleteDraft(this.record.id);
        } finally {
          this.deleting = false;
          this.cdr.markForCheck();
        }
      },
    });

    if (!ok) return;
    this.backNavigation.runAfterOverlayClose(() => {
      this.toaster.success('Checklist excluído com sucesso.');
      void this.router.navigate(['/qualidade/checklist']);
    });
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
    await this.loadContext(this.recordId);
    this.cdr.detectChanges();
  }

  protected async skipChecklist(): Promise<void> {
    const reason = await this.actionModal.open({
      title: 'Pular checklist',
      message: 'Este checklist será encerrado sem preenchimento e o fluxo seguirá para a próxima etapa.',
      inputLabel: 'Justificativa',
      required: true,
      danger: true,
      confirmLabel: 'Pular checklist',
    });

    if (!reason) return;

    try {
      await this.store.skipChecklist(this.record.id, reason);
      await this.loadContext(this.recordId);
      this.toaster.success('Checklist pulado com justificativa.');
      this.cdr.detectChanges();
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível pular o checklist.');
    }
  }

  protected async orderUpdated(): Promise<void> {
    await this.loadContext(this.recordId);
    this.toaster.success('Pedido, cliente e item atualizados em todo o fluxo.');
    this.cdr.detectChanges();
  }
}

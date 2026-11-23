import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ContainerComponent } from '@coreui/angular';
import { ChecklistPendingChanges } from '../../../../../config/checklist-leave.guard';
import { Checklist, Flow } from '../../../../../interface/checklist.interface';
import { checklistCopy as copy } from '../../../../../shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../../services/checklist-preview.service';
import { ChecklistMemorando, ChecklistService } from '../../../../../services/checklist.service';
import { ToastrService } from '../../../../../services/toast.service';
import { ChecklistRecordFormComponent } from '../../../../../../components/forms/checklist/checklist-record-form/checklist-record-form.component';
import { ChecklistActionModalComponent } from '../../../../../../components/modal/checklist/checklist-action-modal/checklist-action-modal.component';
import { ChecklistIconComponent } from '../../../../../../components/icons/checklist-icon/checklist-icon.component';
import { ChecklistUploadModalComponent } from '../../../../../../components/modal/checklist/checklist-upload-modal/checklist-upload-modal.component';
import { ChecklistMemorandosModalComponent } from '../../../../../../components/modal/checklist/checklist-memorandos-modal/checklist-memorandos-modal.component';

@Component({
  selector: 'app-checklist-record-edit',
  imports: [
    CommonModule,
    RouterLink,
    ContainerComponent,
    ChecklistRecordFormComponent,
    ChecklistActionModalComponent,
    ChecklistIconComponent,
    ChecklistUploadModalComponent,
    ChecklistMemorandosModalComponent,
  ],
  templateUrl: './checklist-record-edit.component.html',
  styleUrl: './checklist-record-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistRecordEditComponent implements OnInit, ChecklistPendingChanges {
  @ViewChild(ChecklistActionModalComponent)
  private actionModal!: ChecklistActionModalComponent;
  @ViewChild(ChecklistMemorandosModalComponent)
  private memorandosModal!: ChecklistMemorandosModalComponent;

  protected readonly store = inject(ChecklistPreviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toaster = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly checklistApi = inject(ChecklistService);
  protected record!: Checklist;
  protected flow!: Flow;
  protected dirty = false;
  protected saving = false;
  private memorandosRequest = 0;
  protected relatedMemorandos: ChecklistMemorando[] = [];
  protected memorandosError = false;
  protected readonly memorandoStatuses = { CREATED: 'Rascunho', PUBLISH: 'Publicado', APPROVED: 'Aprovado', CANCELED: 'Cancelado' };

  private blocked = false;
  protected loadError = false;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadError = false;
    try {
      const context = await this.store.loadRecordContext(id, true);
      if (this.destroyRef.destroyed) return;
      if (!context.editable) {
        void this.router.navigate(['/qualidade/checklist', id]);
        return;
      }
      const current = await this.store.claim(context.record);
      if (this.destroyRef.destroyed) return;
      this.blocked = context.blocked;
      this.record = copy(current);
      this.flow = copy(context.flow);
      this.loadRelatedMemorandos(true);
    } catch {
      this.loadError = true;
    } finally {
      if (!this.destroyRef.destroyed) this.cdr.markForCheck();
    }
  }

  protected loadRelatedMemorandos(showAlert = false): void {
    if (this.saving || !this.flow.order || !this.flow.item) return;
    const request = ++this.memorandosRequest;
    this.relatedMemorandos = [];
    this.memorandosError = false;
    this.checklistApi.listRelatedMemorandos(this.record.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        if (request !== this.memorandosRequest) return;
        this.relatedMemorandos = items;
        if (showAlert && items.length) void this.memorandosModal.open(items);
        this.cdr.markForCheck();
      },
      error: () => {
        if (request !== this.memorandosRequest) return;
        this.memorandosError = true;
        this.cdr.markForCheck();
      },
    });
  }

  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty) event.preventDefault();
  }

  canDeactivate(): boolean | Promise<boolean> {
    return !this.dirty || this.confirmDiscard();
  }

  private async confirmDiscard(): Promise<boolean> {
    return !!(await this.actionModal.open({
      title: 'Descartar alterações?',
      message: 'As respostas alteradas ainda não foram salvas.',
      danger: true,
      confirmLabel: 'Descartar',
    }));
  }

  protected changed(): void {
    this.dirty = true;
  }

  protected async save(finish: boolean): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    this.cdr.markForCheck();
    try {
      let confirmed = false;
      if (finish && this.flow.order && this.flow.item) {
        ++this.memorandosRequest;
        const memorandos = await firstValueFrom(this.checklistApi.listRelatedMemorandos(this.record.id));
        if (this.destroyRef.destroyed) return;
        this.relatedMemorandos = memorandos;
        this.memorandosError = false;
        const openMemorandos = memorandos.filter(memorando => memorando.status !== 'APPROVED');
        if (openMemorandos.length) {
          confirmed = !!(await this.actionModal.open({
            title: 'Finalizar checklist?',
            message: 'Existe ao menos um memorando aberto para esse item, deseja continuar mesmo assim? Essa ação será registrada.',
            confirmLabel: 'Continuar e finalizar',
          }));
          if (!confirmed || this.destroyRef.destroyed) return;
        }
      }
      const saved = await this.store.saveRecord(this.record, this.flow, finish, confirmed, { blocked: this.blocked });
      this.dirty = false;
      this.toaster.success(finish ? 'Checklist concluído.' : 'Alterações salvas.');
      void this.router.navigate(['/qualidade/checklist', saved.id]);
    } catch (error: any) {
      this.toaster.warning(error?.error?.error || error?.error?.message || error?.message || 'Não foi possível salvar.');
    } finally {
      this.saving = false;
      if (!this.destroyRef.destroyed) this.cdr.markForCheck();
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/qualidade/checklist', this.record.id]);
  }
}

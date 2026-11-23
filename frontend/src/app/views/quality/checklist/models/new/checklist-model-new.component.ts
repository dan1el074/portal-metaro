import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ContainerComponent } from '@coreui/angular';
import { ChecklistPendingChanges } from '../../../../../config/checklist-leave.guard';
import { Template } from '../../../../../interface/checklist.interface';
import { checklistCopy as copy, checklistId as uid, emptyChecklistSection as emptySection } from '../../../../../shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../../services/checklist-preview.service';
import { ToastrService } from '../../../../../services/toast.service';
import { ChecklistModelFormComponent } from '../../../../../../components/forms/checklist/checklist-model-form/checklist-model-form.component';
import { ChecklistActionModalComponent } from '../../../../../../components/modal/checklist/checklist-action-modal/checklist-action-modal.component';

@Component({ selector: 'app-checklist-model-new', imports: [ContainerComponent, ChecklistModelFormComponent, ChecklistActionModalComponent], templateUrl: './checklist-model-new.component.html', styleUrl: './checklist-model-new.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistModelNewComponent implements OnInit, ChecklistPendingChanges {
  @ViewChild(ChecklistActionModalComponent) private actionModal!: ChecklistActionModalComponent;
  protected readonly store = inject(ChecklistPreviewService); private readonly router = inject(Router); private readonly route = inject(ActivatedRoute); private readonly toaster = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected context!: Awaited<ReturnType<ChecklistPreviewService['loadModelEditor']>>;
  protected model!: Template; protected dirty = false;
  async ngOnInit(): Promise<void> {
    try {
      this.context = await this.store.loadModelEditor(this.route.snapshot.queryParamMap.get('copy'));
      const source = this.context.model;
      const first = this.context.categories[0];
      const sourceCategory = this.context.categories.find(item => item.id === source?.categoryId);
      this.model = source ? {
        ...copy(source), id: uid(), name: sourceCategory?.integration === 'production' ? '' : `${source.name} (cópia)`,
        equipmentId: '', predecessorId: '', automatic: false, optionalPredecessor: false, version: 0,
      } : {
        id: uid(), categoryId: first?.id ?? '', name: '', equipmentId: '', title: '%data',
        sections: [emptySection(first?.integration === 'production')], signature: true,
        predecessorId: '', automatic: false, optionalPredecessor: false, version: 0,
      };
      this.dirty = !!source;
      this.cdr.markForCheck();
    } catch {
      this.toaster.warning('Não foi possível carregar os dados do modelo.');
      void this.router.navigate(['/qualidade/checklist/models']);
    }
  }

  @HostListener('window:beforeunload', ['$event']) beforeUnload(event: BeforeUnloadEvent): void { if (this.dirty) event.preventDefault(); }
  canDeactivate(): boolean | Promise<boolean> { return !this.dirty || this.confirmDiscard(); }
  private async confirmDiscard(): Promise<boolean> { return !!(await this.actionModal.open({ title: 'Descartar alterações?', message: 'As alterações feitas neste modelo ainda não foram salvas.', danger: true, confirmLabel: 'Descartar' })); }
  protected changed(): void { this.dirty = true; }
  protected async save(): Promise<void> { try { await this.store.saveTemplate(this.model, this.context); this.dirty = false; this.toaster.success('Modelo salvo com sucesso.'); void this.router.navigate(['/qualidade/checklist/models']); } catch (error) { this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível salvar.'); } }
  protected cancel(): void { void this.router.navigate(['/qualidade/checklist/models']); }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ContainerComponent } from '@coreui/angular';
import { ChecklistPendingChanges } from '../../../../../config/checklist-leave.guard';
import { Checklist, Flow } from '../../../../../interface/checklist.interface';
import { checklistCopy as copy } from '../../../../../shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../../services/checklist-preview.service';
import { ToastrService } from '../../../../../services/toast.service';
import { ChecklistRecordFormComponent } from '../../../../../../components/forms/checklist/checklist-record-form/checklist-record-form.component';
import { ChecklistActionModalComponent } from '../../../../../../components/modal/checklist/checklist-action-modal/checklist-action-modal.component';
import { ChecklistIconComponent } from '../../../../../../components/icons/checklist-icon/checklist-icon.component';
import { ChecklistUploadModalComponent } from '../../../../../../components/modal/checklist/checklist-upload-modal/checklist-upload-modal.component';

@Component({
  selector: 'app-checklist-record-edit',
  imports: [
    ContainerComponent,
    ChecklistRecordFormComponent,
    ChecklistActionModalComponent,
    ChecklistIconComponent,
    ChecklistUploadModalComponent,
  ],
  templateUrl: './checklist-record-edit.component.html',
  styleUrl: './checklist-record-edit.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistRecordEditComponent implements OnInit, ChecklistPendingChanges {
  @ViewChild(ChecklistActionModalComponent)
  private actionModal!: ChecklistActionModalComponent;

  protected readonly store = inject(ChecklistPreviewService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toaster = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);
  protected record!: Checklist;
  protected flow!: Flow;
  protected dirty = false;

  async ngOnInit(): Promise<void> {
    await this.store.load();
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    const source = this.store.state().records.find((item) => item.id === id);

    if (!source || !this.store.editable(source)) {
      void this.router.navigate(['/qualidade/checklist', id]);
      return;
    }

    await this.store.claim(id);
    const current = this.store.state().records.find((item) => item.id === id)!;
    this.record = copy(current);
    this.flow = copy(this.store.flow(current));
    this.cdr.detectChanges();
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
    try {
      const saved = await this.store.saveRecord(this.record, this.flow, finish);
      this.dirty = false;
      this.toaster.success(finish ? 'Checklist concluído.' : 'Alterações salvas.');
      void this.router.navigate(['/qualidade/checklist', saved.id]);
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível salvar.');
    }
  }

  protected cancel(): void {
    void this.router.navigate(['/qualidade/checklist', this.record.id]);
  }
}

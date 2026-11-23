import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccordionButtonDirective, AccordionComponent, AccordionItemComponent, ButtonDirective, ContainerComponent, TemplateIdDirective, TooltipDirective } from '@coreui/angular';
import { ChecklistPreviewService } from '../../../../services/checklist-preview.service';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ChecklistCategorySummary, ChecklistService, ChecklistTemplateSummary } from '../../../../services/checklist.service';
import { checklistIntegrationLabel } from '../../../../shared/checklist-rules';
import { ToastrService } from '../../../../services/toast.service';
import { ChecklistIconComponent } from '../../../../../components/icons/checklist-icon/checklist-icon.component';
import { ChecklistActionModalComponent } from '../../../../../components/modal/checklist/checklist-action-modal/checklist-action-modal.component';

@Component({
  selector: 'app-checklist-models',
  imports: [
    CommonModule,
    RouterLink,
    ContainerComponent,
    AccordionComponent,
    AccordionItemComponent,
    AccordionButtonDirective,
    TemplateIdDirective,
    ButtonDirective,
    TooltipDirective,
    ChecklistIconComponent,
    ChecklistActionModalComponent,
  ],
  templateUrl: './checklist-models.component.html',
  styleUrl: './checklist-models.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistModelsComponent implements OnInit {
  @ViewChild(ChecklistActionModalComponent)
  private actionModal!: ChecklistActionModalComponent;
  protected readonly store = inject(ChecklistPreviewService);
  private readonly api = inject(ChecklistService);
  protected readonly categories = signal<ChecklistCategorySummary[]>([]);
  protected readonly models = signal<ChecklistTemplateSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal(false);
  private readonly router = inject(Router);
  private readonly toaster = inject(ToastrService);
  protected readonly integrationLabel = checklistIntegrationLabel;

  ngOnInit(): void {
    this.store.requireAdmin();
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(false);
    try {
      const { categories, models } = await firstValueFrom(forkJoin({
        categories: this.api.listCategorySummaries(),
        models: this.api.listTemplateSummaries(),
      }));
      this.categories.set(categories);
      this.models.set(models);
    } catch {
      this.loadError.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected modelsFor(categoryId: string): ChecklistTemplateSummary[] {
    return this.models().filter(item => item.categoryId === categoryId);
  }

  protected modelNumber(id: string): number {
    return this.models().findIndex(item => item.id === id) + 1;
  }

  protected open(id: string): void {
    void this.router.navigate(['/qualidade/checklist/models', id]);
  }

  protected create(): void {
    void this.router.navigate(['/qualidade/checklist/models/new']);
  }

  protected copy(model: ChecklistTemplateSummary): void {
    void this.router.navigate(['/qualidade/checklist/models/new'], {
      queryParams: { copy: model.id },
    });
  }

  protected async remove(model: ChecklistTemplateSummary): Promise<void> {
    if (model.used) return;

    const confirmed = await this.actionModal.open({
      title: 'Excluir modelo',
      message: `O modelo “${model.name}” será excluído definitivamente.`,
      danger: true,
      confirmLabel: 'Excluir',
    });

    if (!confirmed) return;

    try {
      await firstValueFrom(this.api.deleteTemplate(model.id));
      this.models.update(models => models.filter(item => item.id !== model.id));
      await this.load();
      this.toaster.success('Modelo excluído com sucesso.');
    } catch (error) {
      const message = (error as { error?: { error?: string } })?.error?.error;
      this.toaster.warning(message || 'Não foi possível excluir o modelo.');
    }
  }

}

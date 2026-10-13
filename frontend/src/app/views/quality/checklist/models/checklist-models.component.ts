import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AccordionButtonDirective, AccordionComponent, AccordionItemComponent, ButtonDirective, ContainerComponent, TemplateIdDirective, TooltipDirective } from '@coreui/angular';
import { ChecklistPreviewService } from '../../../../services/checklist-preview.service';
import { Template } from '../../../../interface/checklist.interface';
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
  private readonly router = inject(Router);
  private readonly toaster = inject(ToastrService);
  protected readonly integrationLabel = checklistIntegrationLabel;

  async ngOnInit(): Promise<void> {
    await this.store.load();
    this.store.requireAdmin();
  }

  protected equipment(id: string): string {
    const equipment = this.store.state().equipment.find((item) => item.id === id);
    return equipment ? `${equipment.name}` : 'Em branco';
  }

  protected modelsFor(categoryId: string): Template[] {
    return this.store.state().templates.filter((item) => item.categoryId === categoryId);
  }

  protected modelNumber(id: string): number {
    return this.store.state().templates.findIndex((item) => item.id === id) + 1;
  }

  protected open(id: string): void {
    void this.router.navigate(['/qualidade/checklist/models', id]);
  }

  protected create(): void {
    void this.router.navigate(['/qualidade/checklist/models/new']);
  }

  protected copy(model: Template): void {
    void this.router.navigate(['/qualidade/checklist/models/new'], {
      queryParams: { copy: model.id },
    });
  }

  protected async remove(model: Template): Promise<void> {
    if (this.modelUsed(model.id)) return;

    const confirmed = await this.actionModal.open({
      title: 'Excluir modelo',
      message: `O modelo “${model.name}” será excluído definitivamente.`,
      danger: true,
      confirmLabel: 'Excluir',
    });

    if (!confirmed) return;

    try {
      await this.store.deleteTemplate(model.id);
      this.toaster.success('Modelo excluído com sucesso.');
    } catch (error) {
      const message = (error as { error?: { error?: string } })?.error?.error;
      this.toaster.warning(message || 'Não foi possível excluir o modelo.');
    }
  }

  protected modelUsed(id: string): boolean {
    return this.store.state().records.some(record => record.templateId === id)
      || this.store.state().templates.some(template => template.predecessorId === id);
  }
}

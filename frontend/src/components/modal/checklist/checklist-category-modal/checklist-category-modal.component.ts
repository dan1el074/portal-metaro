import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, TooltipDirective,
} from '@coreui/angular';
import { Category } from '../../../../app/interface/checklist.interface';
import { checklistCopy as copy, emptyChecklistCategory as emptyCategory } from '../../../../app/shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ToastrService } from '../../../../app/services/toast.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { ChecklistCategoryFormComponent } from '../../../forms/checklist/checklist-category-form/checklist-category-form.component';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { ChecklistActionModalComponent } from '../checklist-action-modal/checklist-action-modal.component';
import { checklistIntegrationLabel } from '../../../../app/shared/checklist-rules';

@Component({
  selector: 'app-checklist-category-modal',
  imports: [
    ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
    ModalHeaderComponent, ModalTitleDirective, ModalBackNavigationDirective,
    FormsModule, ChecklistCategoryFormComponent, ChecklistIconComponent, ChecklistActionModalComponent, TooltipDirective,
  ],
  templateUrl: './checklist-category-modal.component.html',
  styleUrl: './checklist-category-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistCategoryModalComponent {
  @ViewChild(ChecklistActionModalComponent) private actionModal!: ChecklistActionModalComponent;
  protected visible = false;
  protected editing = false;
  protected category = emptyCategory();
  protected readonly integrationLabel = checklistIntegrationLabel;

  protected get sortedCategories(): Category[] {
    return [...this.store.state().categories].sort((first, second) =>
      first.id.localeCompare(second.id, undefined, { numeric: true })
    );
  }

  constructor(
    protected store: ChecklistPreviewService,
    private toaster: ToastrService,
    private cdr: ChangeDetectorRef,
  ) {}

  public open(): void { this.visible = true; this.editing = false; this.cdr.detectChanges(); }
  protected close(): void { this.visible = false; this.editing = false; this.cdr.detectChanges(); }
  protected onVisibleChange(visible: boolean): void { this.visible = visible; if (!visible) this.editing = false; }
  protected create(): void { this.category = emptyCategory(); this.editing = true; }
  protected edit(category: Category): void { this.category = copy(category); this.editing = true; }
  protected cancelEdit(): void { this.editing = false; }
  protected integrationChanged(): void {
    if (this.category.integration === 'production') { this.category.erp = true; this.category.serial = true; }
  }

  protected async save(): Promise<void> {
    const state = copy(this.store.state());
    this.category.logo = true;
    this.category.dates = false;
    if (!this.category.name.trim()) { this.toaster.warning('Informe o nome da categoria.'); return; }
    if (!this.category.documentTitle.trim()) { this.toaster.warning('Informe o título do cabeçalho.'); return; }
    if (state.categories.some(item => item.id !== this.category.id && item.name.toLocaleLowerCase() === this.category.name.trim().toLocaleLowerCase())) { this.toaster.warning('Já existe uma categoria com este nome.'); return; }
    if (this.category.fields.some(field => !field.label.trim() || (field.type === 'select' && !field.options.length))) { this.toaster.warning('Configure todos os campos adicionais.'); return; }
    const previous = state.categories.find(item => item.id === this.category.id);
    if (previous && previous.integration !== this.category.integration) {
      const confirmed = await this.openAction({
        title: 'Alterar tipo de integração',
        message: 'As configurações de integração dos modelos atuais serão limpas. Fluxos iniciados permanecerão com a versão anterior.',
        confirmLabel: 'Alterar integração',
      });
      if (!confirmed) return;
      state.templates.filter(item => item.categoryId === this.category.id).forEach(template => {
        template.equipmentId = ''; template.predecessorId = ''; template.automatic = false; template.version++;
        if (this.category.integration === 'production') { template.name = ''; template.signature = true; }
        template.sections.forEach(section => section.options = this.category.integration === 'production' ? [...new Set([...section.options, 'NOK'])] : section.options.filter(option => option !== 'NOK'));
      });
    }
    this.category.name = this.category.name.trim();
    this.category.documentTitle = this.category.documentTitle.trim();
    state.categories = [...state.categories.filter(item => item.id !== this.category.id), copy(this.category)];
    const saved = await this.store.commit(state);
    if (!saved) {
      this.toaster.warning('Não foi possível salvar a categoria.');
      this.cdr.detectChanges();
      return;
    }
    this.editing = false;
    this.toaster.success('Categoria salva com sucesso.');
    this.cdr.detectChanges();
  }

  protected async toggle(category: Category): Promise<void> {
    const state = copy(this.store.state()); const target = state.categories.find(item => item.id === category.id)!;
    if (target.active && state.processes.some(process => !process.cancelled && process.categoryId === target.id)) { this.toaster.warning('A categoria é requisito de um Fluxo de etapas ativo.'); return; }
    let reason = '';
    if (target.active) {
      const result = await this.openAction({ title: 'Desativar categoria', message: 'Registros criados poderão ser concluídos. Apenas etapas ainda não geradas serão puladas.', inputLabel: 'Justificativa', required: true, danger: true, confirmLabel: 'Desativar' });
      if (!result) return; reason = result;
    }
    target.active = !target.active; target.reason = reason; this.store.refreshFlows(state); this.store.commit(state); this.cdr.detectChanges();
  }

  protected async remove(category: Category): Promise<void> {
    const state = copy(this.store.state());
    if (state.templates.some(item => item.categoryId === category.id) || state.flows.some(flow => flow.plan.some(step => step.category.id === category.id))) { this.toaster.warning('Categorias com modelos ou histórico não podem ser excluídas.'); return; }
    const confirmed = await this.openAction({ title: 'Excluir categoria', message: `A categoria “${category.name}” será excluída definitivamente.`, confirmLabel: 'Excluir', danger: true });
    if (!confirmed) return;
    state.categories = state.categories.filter(item => item.id !== category.id); this.store.commit(state); this.cdr.detectChanges();
  }

  private async openAction(options: Parameters<ChecklistActionModalComponent['open']>[0]): Promise<string | null> {
    this.visible = false;
    this.cdr.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 180));
    const result = await this.actionModal.open(options);
    await new Promise(resolve => setTimeout(resolve, 180));
    this.visible = true;
    this.cdr.detectChanges();
    return result;
  }
}

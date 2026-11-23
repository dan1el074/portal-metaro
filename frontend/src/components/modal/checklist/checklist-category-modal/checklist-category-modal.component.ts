import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { Category } from '../../../../app/interface/checklist.interface';
import { checklistCopy as copy, emptyChecklistCategory as emptyCategory } from '../../../../app/shared/checklist-factory';
import { firstValueFrom } from 'rxjs';
import { ChecklistCategorySummary, ChecklistService } from '../../../../app/services/checklist.service';
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
  @Output() readonly changed = new EventEmitter<void>();
  protected visible = false;
  protected editing = false;
  protected busy = false;
  protected listError = false;
  protected category = emptyCategory();
  protected categories: ChecklistCategorySummary[] = [];
  protected readonly integrationLabel = checklistIntegrationLabel;

  constructor(
    private api: ChecklistService,
    private toaster: ToastrService,
    private cdr: ChangeDetectorRef,
  ) {}

  public open(): void {
    this.visible = true;
    this.editing = false;
    this.categories = [];
    void this.load();
  }

  protected async load(): Promise<void> {
    this.busy = true;
    this.listError = false;
    this.cdr.markForCheck();
    try {
      this.categories = await firstValueFrom(this.api.listCategorySummaries());
    } catch {
      this.listError = true;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  protected close(): void { this.onVisibleChange(false); }
  protected onVisibleChange(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.editing = false;
    this.cdr.markForCheck();
  }
  protected create(): void { this.category = emptyCategory(); this.editing = true; }

  protected async edit(category: ChecklistCategorySummary): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      const detail = await firstValueFrom(this.api.getCategory(category.id));
      if (this.visible) { this.category = detail; this.editing = true; }
    } catch {
      this.toaster.warning('Não foi possível carregar a categoria.');
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  protected cancelEdit(): void { this.editing = false; }
  protected integrationChanged(): void {
    if (this.category.integration === 'production') { this.category.erp = true; this.category.serial = true; this.category.media = true; }
  }

  protected async save(): Promise<void> {
    if (this.busy) return;
    const category: Category = { ...copy(this.category), logo: true, dates: false };
    category.name = category.name.trim();
    category.documentTitle = category.documentTitle.trim();
    if (!category.name) { this.toaster.warning('Informe o nome da categoria.'); return; }
    if (!category.documentTitle) { this.toaster.warning('Informe o título do cabeçalho.'); return; }
    if (this.categories.some(item => item.id !== category.id && item.name.toLocaleLowerCase() === category.name.toLocaleLowerCase())) {
      this.toaster.warning('Já existe uma categoria com este nome.'); return;
    }
    if (category.fields.some(field => !field.label.trim() || (field.type === 'select' && !field.options.length))) {
      this.toaster.warning('Configure todos os campos adicionais.'); return;
    }
    const previous = this.categories.find(item => item.id === category.id);
    if (previous && previous.integration !== category.integration) {
      const confirmed = await this.openAction({
        title: 'Alterar tipo de integração',
        message: 'As configurações de integração dos modelos atuais serão limpas. Fluxos iniciados permanecerão com a versão anterior.',
        confirmLabel: 'Alterar integração',
      });
      if (!confirmed) return;
    }
    await this.mutate(() => firstValueFrom(previous ? this.api.updateCategory(category) : this.api.createCategory(category)),
      'Categoria salva com sucesso.', 'Não foi possível salvar a categoria.');
  }

  protected async toggle(category: ChecklistCategorySummary): Promise<void> {
    if (this.busy) return;
    let reason = '';
    if (category.active) {
      const result = await this.openAction({
        title: 'Desativar categoria',
        message: 'Registros criados poderão ser concluídos. Apenas etapas ainda não geradas serão puladas.',
        inputLabel: 'Justificativa', required: true, danger: true, confirmLabel: 'Desativar',
      });
      if (!result) return;
      reason = result;
    }
    await this.mutate(() => firstValueFrom(this.api.updateCategoryStatus(category.id, !category.active, reason)),
      'Status da categoria atualizado.', 'Não foi possível atualizar o status da categoria.');
  }

  protected async remove(category: ChecklistCategorySummary): Promise<void> {
    if (this.busy) return;
    const confirmed = await this.openAction({
      title: 'Excluir categoria', message: `A categoria "${category.name}" será excluída definitivamente.`,
      confirmLabel: 'Excluir', danger: true,
    });
    if (!confirmed) return;
    await this.mutate(() => firstValueFrom(this.api.deleteCategory(category.id)),
      'Categoria excluída com sucesso.', 'Não foi possível excluir a categoria.');
  }

  private async mutate(request: () => Promise<unknown>, success: string, failure: string): Promise<void> {
    this.busy = true;
    try {
      await request();
      this.editing = false;
      this.changed.emit();
      this.toaster.success(success);
      await this.load();
    } catch (error) {
      this.toaster.warning((error as { error?: { error?: string } }).error?.error || failure);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
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

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormCheckInputDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { NokFormField, NokFieldType } from '../../../../app/interface/checklist.interface';
import { checklistCopy as copy, checklistId as uid } from '../../../../app/shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ToastrService } from '../../../../app/services/toast.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { ChecklistActionModalComponent } from '../checklist-action-modal/checklist-action-modal.component';
import { checklistIntegrationLabel } from '../../../../app/shared/checklist-rules';
import { ChecklistService } from '../../../../app/services/checklist.service';
import { Observable } from 'rxjs';

@Component({ selector: 'app-checklist-catalog-modal', imports: [FormsModule, ButtonCloseDirective, ButtonDirective, FormCheckInputDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective, ChecklistIconComponent, ChecklistActionModalComponent], templateUrl: './checklist-catalog-modal.component.html', styleUrl: './checklist-catalog-modal.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistCatalogModalComponent {
  @ViewChild(ChecklistActionModalComponent) private actionModal!: ChecklistActionModalComponent;
  protected visible = false; protected tab: 'items' | 'defects' | 'form' | 'history' | 'requirements' = 'items'; protected value = '';
  protected readonly integrationLabel = checklistIntegrationLabel;
  protected formFields: NokFormField[] = [];
  protected historySettings: Record<string, boolean> = {};
  protected requirements: Record<string, string> = {};
  protected readonly steps = [
    { id: 'FINAL_ASSEMBLY', label: 'Montagem Final' },
    { id: 'PCP', label: 'PCP' },
    { id: 'FREIGHT', label: 'Frete' },
    { id: 'BILLING', label: 'Faturamento' },
    { id: 'SHIPPING', label: 'Expedição' },
  ];
  protected newFieldLabel = '';
  protected newFieldType: NokFieldType = 'text';
  protected readonly fieldTypes: { value: NokFieldType; label: string }[] = [
    { value: 'text', label: 'Texto curto' },
    { value: 'number', label: 'Número' },
    { value: 'textarea', label: 'Texto longo' },
    { value: 'items', label: 'Lista de tipos de item' },
    { value: 'defects', label: 'Lista de defeitos' },
    { value: 'departments', label: 'Lista de setores' },
    { value: 'files', label: 'Fotos e vídeos' },
  ];
  protected readonly addableFieldTypes = this.fieldTypes.filter(item => item.value !== 'files');
  constructor(protected store: ChecklistPreviewService, private toaster: ToastrService, private api: ChecklistService, private cdr: ChangeDetectorRef) {}
  public open(): void {
    this.formFields = copy(this.store.state().nokFields);
    this.historySettings = Object.fromEntries(
      this.store.state().categories.map(category => [category.id, category.clientNokHistory]),
    );
    this.visible = true;
    if (this.store.admin) this.loadRequirements();
    this.cdr.detectChanges();
  }
  protected close(): void { this.visible = false; this.cdr.detectChanges(); }
  protected changeTab(tab: 'items' | 'defects' | 'history' | 'requirements'): void { this.tab = tab; this.value = ''; }
  private loadRequirements(): void { this.api.listStepRequirements().subscribe({ next: values => { this.requirements = Object.fromEntries(values.map(value => [value.stepType, String(value.categoryId)])); this.cdr.detectChanges(); } }); }
  protected saveRequirement(stepType: string): void { const categoryId = this.requirements[stepType]; const request: Observable<unknown> = categoryId ? this.api.saveStepRequirement(stepType, categoryId) : this.api.deleteStepRequirement(stepType); request.subscribe({ next: () => { this.toaster.success('Requisito do Fluxo de etapas atualizado.'); this.loadRequirements(); }, error: () => this.toaster.warning('Não foi possível atualizar o requisito.') }); }
  protected add(): void { if (this.tab !== 'items' && this.tab !== 'defects' || (this.tab === 'defects' && !this.store.admin)) return; const tab: 'items' | 'defects' = this.tab; const raw = this.value.trim(); if (!raw) return; const value = tab === 'items' ? raw.charAt(0).toLocaleUpperCase() + raw.slice(1).toLocaleLowerCase() : raw; const data = copy(this.store.state()); if (data[tab].some(item => item.toLocaleLowerCase() === value.toLocaleLowerCase())) { this.toaster.warning('Opção já cadastrada.'); return; } data[tab].push(value); this.store.commit(data); this.value = ''; }
  protected async edit(current: string): Promise<void> { if (this.tab !== 'items' && this.tab !== 'defects') return; const tab: 'items' | 'defects' = this.tab; const raw = await this.openAction({ title: 'Editar opção', message: 'Problemas já registrados preservarão o texto original.', inputLabel: 'Descrição', inputValue: current, required: true, confirmLabel: 'Salvar' }); if (!raw || raw === current) return; const value = tab === 'items' ? raw.charAt(0).toLocaleUpperCase() + raw.slice(1).toLocaleLowerCase() : raw; const data = copy(this.store.state()); if (data[tab].some(item => item !== current && item.toLocaleLowerCase() === value.toLocaleLowerCase())) { this.toaster.warning('Opção já cadastrada.'); return; } data[tab] = data[tab].map(item => item === current ? value : item); this.store.commit(data); this.cdr.detectChanges(); }
  protected async remove(value: string): Promise<void> { if (this.tab !== 'items' && this.tab !== 'defects') return; const tab: 'items' | 'defects' = this.tab; const confirmed = await this.openAction({ title: 'Remover opção', message: 'A opção deixará de aparecer nas novas seleções. Respostas existentes serão preservadas.', confirmLabel: 'Remover', danger: true }); if (!confirmed) return; const data = copy(this.store.state()); data[tab] = data[tab].filter(item => item !== value); this.store.commit(data); this.cdr.detectChanges(); }
  protected fieldTypeLabel(type: NokFieldType): string { return this.fieldTypes.find(item => item.value === type)?.label || type; }
  protected addField(): void {
    const label = this.newFieldLabel.trim();
    if (!label) return;
    this.formFields.push({ id: uid(), label, type: this.newFieldType, required: true });
    this.newFieldLabel = '';
    this.newFieldType = 'text';
  }
  protected moveField(index: number, offset: number): void {
    const destination = index + offset;
    if (destination < 0 || destination >= this.formFields.length) return;
    const [field] = this.formFields.splice(index, 1);
    this.formFields.splice(destination, 0, field);
  }
  protected removeField(index: number): void { this.formFields.splice(index, 1); }
  protected saveForm(): void {
    this.store.requireAdmin();
    if (!this.formFields.length) { this.toaster.warning('Mantenha pelo menos um campo no formulário.'); return; }
    if (this.formFields.some(field => !field.label.trim())) { this.toaster.warning('Informe o nome de todos os campos.'); return; }
    const data = copy(this.store.state());
    data.nokFields = copy(this.formFields).map(field => ({ ...field, label: field.label.trim() }));
    this.store.commit(data);
    this.formFields = copy(data.nokFields);
    this.toaster.success('Formulário de NOK atualizado.');
    this.cdr.detectChanges();
  }
  protected historyEnabled(categoryId: string): boolean {
    return this.historySettings[categoryId] ?? false;
  }
  protected toggleHistory(categoryId: string): void {
    this.store.requireAdmin();
    this.historySettings[categoryId] = !this.historyEnabled(categoryId);
    this.cdr.detectChanges();
  }
  protected saveHistory(): void {
    this.store.requireAdmin();
    const data = copy(this.store.state());
    data.categories.forEach(category => {
      category.clientNokHistory = this.historyEnabled(category.id);
    });
    this.store.commit(data);
    this.historySettings = Object.fromEntries(
      data.categories.map(category => [category.id, category.clientNokHistory]),
    );
    this.toaster.success('Histórico por categoria atualizado.');
    this.cdr.detectChanges();
  }
  private async openAction(options: Parameters<ChecklistActionModalComponent['open']>[0]): Promise<string | null> { this.visible = false; this.cdr.detectChanges(); await new Promise(resolve => setTimeout(resolve, 180)); const result = await this.actionModal.open(options); await new Promise(resolve => setTimeout(resolve, 180)); this.visible = true; this.cdr.detectChanges(); return result; }
}

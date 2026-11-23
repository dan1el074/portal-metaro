import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, ViewChild } from '@angular/core';
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
import { ChecklistCatalogEntry, ChecklistCategoryHistory, ChecklistCategorySummary, ChecklistDepartment, ChecklistService } from '../../../../app/services/checklist.service';
import { firstValueFrom, forkJoin, Observable, Subscription } from 'rxjs';

type CatalogTab = 'items' | 'defects';
type SettingsTab = CatalogTab | 'form' | 'history' | 'requirements' | 'departments';

@Component({ selector: 'app-checklist-catalog-modal', imports: [FormsModule, ButtonCloseDirective, ButtonDirective, FormCheckInputDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective, ChecklistIconComponent, ChecklistActionModalComponent], templateUrl: './checklist-catalog-modal.component.html', styleUrl: './checklist-catalog-modal.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistCatalogModalComponent implements OnDestroy {
  @ViewChild(ChecklistActionModalComponent) private actionModal!: ChecklistActionModalComponent;
  protected visible = false;
  protected tab: SettingsTab = 'items';
  protected value = '';
  protected readonly integrationLabel = checklistIntegrationLabel;
  protected departments: ChecklistDepartment[] = [];
  protected categories: ChecklistCategorySummary[] = [];
  protected historyCategories: ChecklistCategoryHistory[] = [];
  protected busy = false;
  protected loading = false;
  protected loadError = false;
  protected catalog: Partial<Record<CatalogTab, ChecklistCatalogEntry[]>> = {};
  private readonly loadedTabs = new Set<SettingsTab>();
  private request?: Subscription;

  protected get historyLoaded(): boolean { return this.loadedTabs.has('history'); }
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

  constructor(
    protected store: ChecklistPreviewService,
    private toaster: ToastrService,
    private api: ChecklistService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void { this.request?.unsubscribe(); }

  public open(): void {
    this.formFields = copy(this.store.state().nokFields);
    this.loadedTabs.clear();
    this.catalog = {};
    this.visible = true;
    this.changeTab('items');
  }

  protected close(): void { this.onVisibleChange(false); }

  protected onVisibleChange(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.request?.unsubscribe();
    this.cdr.markForCheck();
  }

  protected changeTab(tab: SettingsTab): void {
    if (this.busy) return;
    this.tab = tab;
    this.value = '';
    this.loadTab();
  }

  protected loadTab(): void {
    this.request?.unsubscribe();
    this.loadError = false;
    this.loading = false;
    const tab = this.tab;
    if (this.loadedTabs.has(tab)) { this.cdr.markForCheck(); return; }

    switch (tab) {
      case 'items':
      case 'defects':
        this.load(this.api.listCatalog(tab === 'items' ? 'ITEM' : 'DEFECT'),
          values => this.catalog[tab] = values.filter(entry => entry.active));
        break;
      case 'departments':
        this.load(this.api.listDepartments(), values => this.departments = values);
        break;
      case 'requirements':
        this.load(forkJoin({
          requirements: this.api.listStepRequirements(),
          categories: this.api.listCategorySummaries(),
        }), ({ categories, requirements }) => {
          this.categories = categories;
          this.requirements = Object.fromEntries(requirements.map(value => [value.stepType, String(value.categoryId)]));
        });
        break;
      case 'history':
        this.load(this.api.listCategoryHistorySettings(), values => {
          this.historyCategories = values;
          this.historySettings = Object.fromEntries(values.map(category => [category.id, category.clientNokHistory]));
        });
        break;
    }
  }

  private load<T>(request: Observable<T>, apply: (value: T) => void): void {
    const tab = this.tab;
    this.loading = true;
    this.request = request.subscribe({
      next: value => {
        apply(value);
        this.loadedTabs.add(tab);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      },
    });
    this.cdr.markForCheck();
  }

  protected async saveDepartments(): Promise<void> {
    await this.save(this.api.saveDepartments(this.departments.filter(item => item.enabled).map(item => item.id)),
      'Não foi possível salvar os setores responsáveis.', values => {
        this.departments = values;
        this.toaster.success('Setores responsáveis atualizados.');
      });
  }

  protected async saveRequirement(stepType: string): Promise<void> {
    const categoryId = this.requirements[stepType];
    const request: Observable<unknown> = categoryId
      ? this.api.saveStepRequirement(stepType, categoryId)
      : this.api.deleteStepRequirement(stepType);
    await this.save(request, 'Não foi possível atualizar o requisito.', () => {
      this.toaster.success('Requisito do Fluxo de etapas atualizado.');
    });
  }

  protected async add(): Promise<void> {
    const tab = this.tab;
    if ((tab !== 'items' && tab !== 'defects') || (tab === 'defects' && !this.store.admin)) return;
    const name = this.value.trim();
    if (!name || this.duplicate(tab, name)) return;
    await this.save(this.api.createCatalog(tab === 'items' ? 'ITEM' : 'DEFECT', name),
      'Não foi possível adicionar a opção.', entry => {
        this.setEntries(tab, [...(this.catalog[tab] ?? []), entry]);
        this.value = '';
      });
  }

  protected async edit(entry: ChecklistCatalogEntry): Promise<void> {
    const tab = this.tab;
    if (this.busy || (tab !== 'items' && tab !== 'defects')) return;
    const name = await this.openAction({
      title: 'Editar opção',
      message: 'Problemas já registrados preservarão o texto original.',
      inputLabel: 'Descrição', inputValue: entry.name, required: true, confirmLabel: 'Salvar',
    });
    if (!name || name === entry.name || this.duplicate(tab, name, entry.id)) return;

    await this.save(this.api.updateCatalog({ ...entry, name }), 'Não foi possível editar a opção.', saved => {
      this.setEntries(tab, (this.catalog[tab] ?? []).map(item => item.id === saved.id ? saved : item));
    });
  }

  protected async remove(entry: ChecklistCatalogEntry): Promise<void> {
    const tab = this.tab;
    if (this.busy || (tab !== 'items' && tab !== 'defects')) return;
    const confirmed = await this.openAction({
      title: 'Remover opção',
      message: 'A opção deixará de aparecer nas novas seleções. Respostas existentes serão preservadas.',
      confirmLabel: 'Remover', danger: true,
    });
    if (!confirmed) return;

    await this.save(this.api.updateCatalog({ ...entry, active: false }), 'Não foi possível remover a opção.', () => {
      this.setEntries(tab, (this.catalog[tab] ?? []).filter(item => item.id !== entry.id));
    });
  }

  private duplicate(tab: CatalogTab, name: string, exceptId?: number): boolean {
    const duplicate = this.catalog[tab]?.some(item => item.id !== exceptId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (duplicate) this.toaster.warning('Opção já cadastrada.');
    return !!duplicate;
  }

  private setEntries(tab: CatalogTab, values: ChecklistCatalogEntry[]): void {
    this.catalog[tab] = values.sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'));
  }

  private async save<T>(request: Observable<T>, errorMessage: string, apply: (value: T) => void): Promise<void> {
    if (this.busy || this.loading || this.loadError) return;
    this.busy = true;
    try {
      apply(await firstValueFrom(request));
    } catch (error) {
      this.toaster.warning((error as { error?: { error?: string } }).error?.error || errorMessage);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  protected fieldTypeLabel(type: NokFieldType): string {
    return this.fieldTypes.find(item => item.value === type)?.label || type;
  }

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

  protected removeField(index: number): void {
    this.formFields.splice(index, 1);
  }

  protected saveForm(): void {
    this.store.requireAdmin();

    if (!this.formFields.length) {
      this.toaster.warning('Mantenha pelo menos um campo no formulário.');
      return;
    }
    if (this.formFields.some(field => !field.label.trim())) {
      this.toaster.warning('Informe o nome de todos os campos.');
      return;
    }

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

  protected async saveHistory(): Promise<void> {
    const changed = this.historyCategories.filter(category => category.clientNokHistory !== this.historyEnabled(category.id));
    if (!changed.length) return;
    const settings = Object.fromEntries(changed.map(category => [category.id, this.historyEnabled(category.id)]));
    await this.save(this.api.updateCategoryHistory(settings), 'Não foi possível salvar o histórico por categoria.', () => {
      changed.forEach(category => category.clientNokHistory = this.historyEnabled(category.id));
      this.toaster.success('Histórico por categoria atualizado.');
    });
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

import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, CardBodyComponent, CardComponent, ContainerComponent, DropdownComponent, DropdownItemDirective, DropdownItemPlainDirective, DropdownMenuDirective, DropdownToggleDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, ModalToggleDirective, Tabs2Module } from '@coreui/angular';
import { SmartPaginationComponent } from '@coreui/angular-pro';
import { finalize, forkJoin, map, of } from 'rxjs';
import { RawMaterialsTableComponent } from '../../../../components/table/raw-materials-table/raw-materials-table.component';
import { calculateRawMaterialUnitWeight, formatRawMaterialDecimal, RawMaterialCategory, RawMaterialDimensionField, RawMaterialHistory, RawMaterialStockStatus, RawMaterialSummary, RawMaterialsTable, RawMaterialUserAccess, RawMaterialView } from '../../../interface/raw-materials.interface';
import { RawMaterialsService } from '../../../services/raw-materials.service';
import { UserService } from '../../../services/user.service';
import { environment } from '../../../../environments/environment';
import { RawMaterialsOverviewComponent } from '../../../../components/raw-materials/raw-materials-overview/raw-materials-overview.component';
import { ModalBackNavigationDirective } from '../../../directive/modal-back-navigation.directive';
import { ErrorService } from '../../../services/error.service';
import { ToastrService } from '../../../services/toast.service';
import { BackNavigationService } from '../../../services/back-navigation.service';

@Component({
  selector: 'app-raw-materials',
  imports: [
    CommonModule,
    FormsModule,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    ButtonDirective,
    DropdownComponent,
    DropdownItemDirective,
    DropdownItemPlainDirective,
    DropdownMenuDirective,
    DropdownToggleDirective,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalToggleDirective,
    ButtonCloseDirective,
    Tabs2Module,
    SmartPaginationComponent,
    RawMaterialsTableComponent,
    RawMaterialsOverviewComponent,
  ],
  templateUrl: './raw-materials.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './raw-materials.component.scss',
})
export class RawMaterialsComponent implements OnInit {
  protected readonly apiUrl = environment.apiUrl;
  protected isAdmin = false;
  protected canSwitchViews = false;
  protected currentView: RawMaterialView = 'operator';
  protected readonly views: Array<{ value: RawMaterialView; label: string; description: string }> = [
    { value: 'admin', label: 'Administrador', description: 'Gestão completa' },
    { value: 'operator', label: 'Operador', description: 'Atualização de estoque' },
    { value: 'consultation', label: 'Consulta', description: 'Somente visualização' },
  ];

  protected data: RawMaterialsTable[] = [];
  protected categories: RawMaterialCategory[] = [];
  protected users: RawMaterialUserAccess[] = [];
  protected summary: RawMaterialSummary = { low: 0, ok: 0, high: 0 };
  protected loadingTable = true;
  protected currentPage = 1;
  protected totalPages = 1;
  protected totalItems = 0;
  protected itemsPerPage = 10;
  protected currentSearch = '';
  protected currentCategory = '';
  protected currentStatus: RawMaterialStockStatus = 'all';
  protected showInactive = false;
  protected activeInventoryTab = '';

  protected itemModalVisible = false;
  protected deactivationModalVisible = false;
  protected deactivationReason = '';
  protected stockModalVisible = false;
  protected accessModalVisible = false;
  protected accessUsers: RawMaterialUserAccess[] = [];
  protected categoryReleaseModalVisible = false;
  protected categoryEditModalVisible = false;
  protected pendingCategoryName = '';
  protected history: RawMaterialHistory[] = [];
  protected historyPage = 1;
  protected historySize = 10;
  protected historyTotalPages = 1;
  protected historyTotalElements = 0;
  protected loadingHistory = false;
  protected editingItem: RawMaterialsTable | null = null;
  protected stockTarget: RawMaterialsTable | null = null;
  protected stockQuantity = 0;
  protected stockKg = 0;
  protected newCategoryName = '';
  protected editingCategoryId: number | null = null;
  protected editingCategoryName = '';
  protected editingCategoryConversionFactor = '';
  protected editingCategoryDimensionFields: RawMaterialDimensionField[] = [];
  protected readonly dimensionOptions: Array<{ value: RawMaterialDimensionField; label: string }> = [
    { value: 'length', label: 'Comprimento' },
    { value: 'width', label: 'Largura' },
    { value: 'thickness', label: 'Espessura' },
    { value: 'height', label: 'Altura' },
    { value: 'weightPerSquareMeter', label: 'Peso por metro quadrado' },
    { value: 'litersPerUnit', label: 'Litros por unidade' },
    { value: 'weightPerLinearMeter', label: 'Peso por metro linear' },
  ];
  protected categoryEditError = '';
  protected categoryDeleteError = '';
  protected itemSaveError = '';
  protected itemFormSubmitted = false;
  protected saving = false;

  private currentSort?: { column: string; state: 'asc' | 'desc' };
  private searchTimer?: ReturnType<typeof setTimeout>;
  private readonly destroyRef = inject(DestroyRef);
  private readonly backNavigation = inject(BackNavigationService);

  constructor(
    private rawMaterialsService: RawMaterialsService,
    private userService: UserService,
    private cdf: ChangeDetectorRef,
    private errorService: ErrorService,
    private toasterService: ToastrService,
  ) {}

  ngOnInit(): void {
    this.resolveAccess();
    if (this.currentView !== 'operator' || this.isAdmin) this.loadSummary();
    this.loadInventoryAccess();
  }

  protected setView(view: RawMaterialView): void {
    if (!this.canSwitchViews) return;
    this.currentView = view;
    this.currentPage = 1;
    this.currentSearch = '';
    this.currentStatus = 'all';
    this.showInactive = false;
    this.selectDefaultCategory();
    this.loadItems();
  }

  protected onInventoryTabChange(key: string | number | undefined): void {
    if (key === undefined) return;
    const tab = String(key);

    if (tab === 'inactive') {
      if (!this.canAccessInactive()) return;
      this.activeInventoryTab = tab;
      this.currentCategory = '';
      this.showInactive = true;
    } else if (tab.startsWith('category-')) {
      const categoryId = Number(tab.replace('category-', ''));
      const category = this.categories.find(item => item.id === categoryId);
      if (!category || !this.canAccessCategory(category)) return;
      this.activeInventoryTab = tab;
      this.currentCategory = category.name;
      this.showInactive = false;
    } else return;

    this.currentPage = 1;
    this.loadItems();
  }

  protected canAccessCategory(category: RawMaterialCategory): boolean {
    if (this.isAdmin || this.currentView !== 'operator') return true;
    return this.currentOperatorAccess()?.categoryIds.includes(category.id) ?? false;
  }

  protected canAccessInactive(): boolean {
    return this.isAdmin || this.currentView === 'consultation';
  }

  protected filterByStatus(status: RawMaterialStockStatus): void {
    this.currentStatus = status;
    this.currentPage = 1;
    this.loadItems();
  }

  protected onFilterChange(value: string): void {
    this.currentSearch = value;
    this.currentPage = 1;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadItems(), 300);
  }

  protected onStatusChange(value: RawMaterialStockStatus): void {
    this.currentStatus = value;
    this.currentPage = 1;
    this.loadItems();
  }

  protected onSorterChange(sorter: any): void {
    this.currentSort = sorter?.state && sorter?.column
      ? { column: sorter.column, state: sorter.state }
      : undefined;
    this.currentPage = 1;
    this.loadItems();
  }

  protected onItemsPerPageChange(value: number): void {
    this.itemsPerPage = value;
    this.currentPage = 1;
    this.loadItems();
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.loadItems();
  }

  protected clearFilters(): void {
    this.currentSearch = '';
    this.currentStatus = 'all';
    this.currentSort = undefined;
    this.currentPage = 1;
    this.loadItems();
  }

  protected openItemModal(item?: RawMaterialsTable): void {
    if (!this.isAdmin && !(this.currentView === 'consultation' && item)) return;
    this.saving = false;
    this.itemSaveError = '';
    this.itemFormSubmitted = false;
    this.deactivationReason = '';
    this.deactivationModalVisible = false;
    this.editingItem = item
      ? this.formatItemDimensions({ ...item, categoryId: this.categories.find(category => category.name === item.type)?.id })
      : {
          id: 0,
          code: '',
          name: '',
          description: '',
          type: this.categories[0]?.name ?? '',
          categoryId: this.categories[0]?.id,
          currentStorage: 0,
          currentStorageKg: 0,
          minStorage: 0,
          minStorageKg: 0,
          maxStorage: 0,
          maxStorageKg: 0,
          length: '',
          width: '',
          thickness: '',
          height: '',
          weightPerSquareMeter: '',
          litersPerUnit: '',
          weightPerLinearMeter: '',
          active: true,
          updateAt: new Date().toISOString(),
          user: this.userService.getCurrentUser()?.name ?? 'Administrador',
        };
    this.itemModalVisible = true;
    this.history = [];
  }

  protected toggleActive(checkbox: HTMLInputElement): void {
    if (!this.editingItem) return;
    this.deactivationReason = '';
    if (!checkbox.checked) {
      checkbox.checked = true;
      // Finish removing the item's history entry before opening the confirmation.
      this.backNavigation.runAfterOverlayClose(() => {
        if (this.destroyRef.destroyed) return;
        this.deactivationModalVisible = true;
        this.cdf.detectChanges();
      });
      this.itemModalVisible = false;
    } else {
      this.editingItem.active = true;
    }
  }

  protected confirmDeactivation(): void {
    if (!this.editingItem || !this.deactivationReason.trim()) return;
    this.editingItem.active = false;
    this.closeDeactivationModal();
  }

  protected onDeactivationModalVisibleChange(visible: boolean): void {
    if (!visible && this.deactivationModalVisible) this.closeDeactivationModal();
  }

  protected closeDeactivationModal(): void {
    if (!this.deactivationModalVisible) return;
    this.deactivationModalVisible = false;
    // Reopen the item only after the confirmation's history entry is consumed.
    this.backNavigation.runAfterOverlayClose(() => {
      if (this.destroyRef.destroyed) return;
      this.itemModalVisible = true;
      this.cdf.detectChanges();
    });
  }

  protected closeItemModal(): void {
    this.saving = false;
    this.itemSaveError = '';
    this.itemFormSubmitted = false;
    this.itemModalVisible = false;
    this.editingItem = null;
    this.history = [];
  }

  protected formatDimensionField(field: RawMaterialDimensionField): void {
    if (!this.editingItem) return;
    if (String(this.editingItem[field] ?? '').trim() === '') return;
    this.editingItem[field] = formatRawMaterialDecimal(this.editingItem[field]);
  }

  protected saveItem(): void {
    this.itemFormSubmitted = true;
    this.itemSaveError = '';
    if (this.currentView === 'consultation' || !this.editingItem || this.hasInvalidItemForm()) return;
    this.editingItem = this.formatItemDimensions(this.editingItem);
    this.editingItem.categoryId = this.categories.find(category => category.name === this.editingItem?.type)?.id;
    if (!this.editingItem.categoryId) return;
    this.itemSaveError = '';
    this.saving = true;
    const isEditing = this.editingItem.id > 0;
    const reason = !this.editingItem.active ? this.deactivationReason.trim() : '';
    this.rawMaterialsService.saveItem(this.editingItem, reason || undefined)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdf.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.closeItemModal();
          this.loadItems();
          this.loadSummary();
          this.toasterService.success(isEditing ? 'Item atualizado com sucesso!' : 'Item criado com sucesso!');
        },
        error: error => {
          this.itemSaveError = this.resolveErrorMessage(error);
          this.errorService.showError(error);
        },
      });
  }

  protected openStockModal(item: RawMaterialsTable): void {
    if (this.currentView !== 'operator') return;
    this.stockTarget = { ...item };
    this.stockQuantity = item.currentStorage;
    this.stockKg = item.currentStorageKg;
    this.stockModalVisible = true;
  }

  protected onStockModalVisibleChange(visible: boolean): void {
    if (!visible && this.stockModalVisible) this.closeStockModal();
  }

  protected closeStockModal(): void {
    this.stockModalVisible = false;
    this.stockTarget = null;
  }

  protected openTableItem(item: RawMaterialsTable): void {
    if (this.currentView === 'admin' || this.currentView === 'consultation') {
      this.openItemModal(item);
      return;
    }

    if (this.currentView === 'operator') this.openStockModal(item);
  }

  protected changeStock(delta: number): void {
    if (!this.stockTarget) return;
    this.stockQuantity = Math.max(0, this.stockQuantity + delta);
    this.updateStockWeight();
  }

  protected updateStockWeight(): void {
    if (!this.stockTarget) return;
    this.stockKg = Number((this.stockQuantity * this.calculatedUnitWeight(this.stockTarget)).toFixed(2));
  }

  protected calculatedUnitWeight(item: RawMaterialsTable): number {
    return calculateRawMaterialUnitWeight(item, this.categoryConversionFactor(item));
  }

  protected categoryConversionFactor(item: RawMaterialsTable): string {
    return this.categories.find(category => category.name === item.type)?.conversionFactor ?? '';
  }

  protected categoryConversionFactorLabel(item: RawMaterialsTable): string {
    const labels: Record<string, string> = {
      c: 'comprimento',
      l: 'largura',
      e: 'espessura',
      a: 'altura',
      p: 'peso por metro quadrado',
      u: 'litros por unidade',
      m: 'peso por metro linear',
    };
    return this.categoryConversionFactor(item).replace(/%([a-z])/gi,
      (token, variable: string) => labels[variable.toLowerCase()] ?? token);
  }

  protected categoryUsesDimension(field: RawMaterialDimensionField): boolean {
    const category = this.categories.find(item => item.name === this.editingItem?.type);
    return category?.dimensionFields?.includes(field) ?? false;
  }

  protected hasInvalidStockRange(): boolean {
    if (!this.editingItem) return false;
    const minimum = Number(this.editingItem.minStorage);
    const maximum = Number(this.editingItem.maxStorage);
    return minimum > 0 && maximum > 0 && maximum < minimum;
  }

  protected isCodeInvalid(): boolean {
    return this.itemFormSubmitted && !this.editingItem?.code?.trim();
  }

  protected isNameInvalid(): boolean {
    return this.itemFormSubmitted && (this.editingItem?.name?.trim().length ?? 0) < 5;
  }

  protected isCategoryInvalid(): boolean {
    return this.itemFormSubmitted && !this.editingItem?.type;
  }

  protected hasInvalidItemForm(): boolean {
    return !this.editingItem?.code?.trim()
      || (this.editingItem?.name?.trim().length ?? 0) < 5
      || !this.editingItem?.type
      || this.hasInvalidStockRange();
  }

  private formatItemDimensions(item: RawMaterialsTable): RawMaterialsTable {
    return {
      ...item,
      length: formatRawMaterialDecimal(item.length),
      width: formatRawMaterialDecimal(item.width),
      thickness: formatRawMaterialDecimal(item.thickness),
      height: formatRawMaterialDecimal(item.height),
      weightPerSquareMeter: formatRawMaterialDecimal(item.weightPerSquareMeter),
      litersPerUnit: formatRawMaterialDecimal(item.litersPerUnit),
      weightPerLinearMeter: formatRawMaterialDecimal(item.weightPerLinearMeter),
    };
  }

  protected saveStock(): void {
    if (!this.stockTarget) return;
    this.saving = true;
    const user = this.userService.getCurrentUser()?.name ?? 'Operador';
    this.rawMaterialsService.updateStock(this.stockTarget.id, this.stockQuantity, this.stockKg, user)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdf.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.closeStockModal();
          this.loadItems();
          if (this.currentView !== 'operator' || this.isAdmin) this.loadSummary();
          this.toasterService.success('Estoque atualizado com sucesso!');
        },
        error: error => this.errorService.showError(error),
      });
  }

  protected addCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name || this.categories.some(category => category.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) return;
    this.pendingCategoryName = name;
    this.categoryReleaseModalVisible = true;
  }

  protected confirmAddCategory(releaseToAll: boolean): void {
    if (!this.pendingCategoryName) return;
    this.rawMaterialsService.addCategory(this.pendingCategoryName, releaseToAll).subscribe({
      next: category => {
        this.categories = this.sortCategories([...this.categories, category]);
        this.newCategoryName = '';
        this.pendingCategoryName = '';
        this.categoryReleaseModalVisible = false;
        this.categoryDeleteError = '';
        if (releaseToAll) this.users = this.users.map(user => ({ ...user, categoryIds: [...user.categoryIds, category.id] }));
        this.toasterService.success('Categoria criada com sucesso!');
        this.cdf.detectChanges();
      },
      error: error => this.errorService.showError(error),
    });
  }

  protected prepareHistory(): void {
    if (!this.editingItem?.id) return;
    this.historySize = 10;
    this.historyPage = 1;
    this.loadHistory();
  }

  protected onHistoryPageChange(page: number): void {
    this.historyPage = page;
    this.loadHistory();
  }

  protected showCompleteHistory(): void {
    this.historySize = 25;
    this.historyPage = 1;
    this.loadHistory();
  }

  protected historyAction(movement: RawMaterialHistory): string {
    const label = ({ CREATED: 'Item criado', UPDATED: 'Dados alterados', STOCK_UPDATED: 'Estoque atualizado',
      STOCK_AND_ITEM_UPDATED: 'Dados alterados' })[movement.action];
    return movement.changedFields?.length ? `${label} (${movement.changedFields.join(', ')})` : label;
  }

  private loadHistory(): void {
    if (!this.editingItem?.id) return;
    this.loadingHistory = true;
    this.rawMaterialsService.getHistory(this.editingItem.id, this.historyPage - 1, this.historySize).subscribe(page => {
      this.history = page.content;
      this.historyTotalPages = Math.max(page.totalPages, 1);
      this.historyTotalElements = page.totalElements;
      this.loadingHistory = false;
      this.cdf.detectChanges();
    });
  }

  protected startCategoryEdit(category: RawMaterialCategory): void {
    this.editingCategoryId = category.id;
    this.editingCategoryName = category.name;
    this.editingCategoryConversionFactor = category.conversionFactor ?? '';
    this.editingCategoryDimensionFields = [...category.dimensionFields];
    this.categoryEditError = '';
    this.categoryDeleteError = '';
    this.categoryEditModalVisible = true;
  }

  protected cancelCategoryEdit(): void {
    this.categoryEditModalVisible = false;
    this.editingCategoryId = null;
    this.editingCategoryName = '';
    this.editingCategoryConversionFactor = '';
    this.editingCategoryDimensionFields = [];
    this.categoryEditError = '';
  }

  protected toggleCategoryDimension(field: RawMaterialDimensionField): void {
    this.editingCategoryDimensionFields = this.editingCategoryDimensionFields.includes(field)
      ? this.editingCategoryDimensionFields.filter(current => current !== field)
      : [...this.editingCategoryDimensionFields, field];
  }

  protected inactiveFormulaVariables(): string[] {
    const dimensionByVariable: Record<string, RawMaterialDimensionField> = {
      c: 'length',
      l: 'width',
      e: 'thickness',
      a: 'height',
      p: 'weightPerSquareMeter',
      u: 'litersPerUnit',
      m: 'weightPerLinearMeter',
    };
    const variables = [...this.editingCategoryConversionFactor.matchAll(/%([a-z])/gi)]
      .map(match => match[1].toLowerCase());
    return [...new Set(variables)].filter(variable => {
      const dimension = dimensionByVariable[variable];
      return dimension && !this.editingCategoryDimensionFields.includes(dimension);
    });
  }

  protected inactiveFormulaError(): string {
    const variables = this.inactiveFormulaVariables().map(variable => `%${variable}`);
    if (!variables.length) return '';
    return `${variables.join(', ')} ${variables.length === 1 ? 'não está disponível' : 'não estão disponíveis'} porque o campo correspondente não está ativo.`;
  }

  protected saveCategoryEdit(): void {
    const name = this.editingCategoryName.trim();
    const category = this.categories.find(current => current.id === this.editingCategoryId);
    if (!name || !category) return;
    const inactiveVariableError = this.inactiveFormulaError();
    if (inactiveVariableError) {
      this.categoryEditError = inactiveVariableError;
      return;
    }
    this.categoryEditError = '';
    this.saving = true;
    this.rawMaterialsService.updateCategory(category.id, name, this.editingCategoryConversionFactor.trim() || null,
      this.editingCategoryDimensionFields)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdf.detectChanges();
      }))
      .subscribe({
        next: updated => {
          if (this.currentCategory === category.name) this.currentCategory = updated.name;
          this.categories = this.sortCategories(
            this.categories.map(current => current.id === updated.id ? updated : current),
          );
          this.cancelCategoryEdit();
          this.categoryDeleteError = '';
          this.loadItems();
          this.toasterService.success('Categoria atualizada com sucesso!');
        },
        error: error => {
          this.categoryEditError = this.resolveErrorMessage(error);
          this.errorService.showError(error);
        },
      });
  }

  protected deleteCategory(category: RawMaterialCategory): void {
    this.categoryDeleteError = '';
    this.rawMaterialsService.deleteCategory(category.id).subscribe({
      next: () => {
        this.categories = this.categories.filter(current => current.id !== category.id);
        if (this.activeInventoryTab === `category-${category.id}`) {
          this.selectDefaultCategory();
          this.loadItems();
        }
        this.users = this.users.map(user => ({
          ...user,
          categoryIds: user.categoryIds.filter(categoryId => categoryId !== category.id),
        }));
        this.categoryDeleteError = '';
        this.toasterService.success('Categoria apagada com sucesso!');
        this.cdf.detectChanges();
      },
      error: error => {
        this.categoryDeleteError = this.resolveErrorMessage(error);
        this.errorService.showError(error);
        this.cdf.detectChanges();
      },
    });
  }

  protected openAccessModal(): void {
    this.accessUsers = this.users.map(user => ({ ...user, categoryIds: [...user.categoryIds] }));
    this.accessModalVisible = true;
  }

  protected closeAccessModal(): void {
    this.accessModalVisible = false;
    this.accessUsers = [];
  }

  protected onAccessModalVisibleChange(visible: boolean): void {
    if (!visible) this.closeAccessModal();
  }

  protected userHasCategory(user: RawMaterialUserAccess, categoryId: number): boolean {
    return user.categoryIds.includes(categoryId);
  }

  protected toggleUserCategory(user: RawMaterialUserAccess, categoryId: number): void {
    user.categoryIds = user.categoryIds.includes(categoryId)
      ? user.categoryIds.filter(id => id !== categoryId)
      : [...user.categoryIds, categoryId];
  }

  protected saveUserAccess(): void {
    this.saving = true;
    this.rawMaterialsService.updateUserAccess(this.accessUsers)
      .pipe(finalize(() => {
        this.saving = false;
        this.cdf.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.users = this.accessUsers.map(user => ({ ...user, categoryIds: [...user.categoryIds] }));
          this.closeAccessModal();
          this.toasterService.success('Permissões atualizadas com sucesso!');
          this.cdf.detectChanges();
        },
        error: error => this.errorService.showError(error),
      });
  }

  protected viewLabel(): string {
    return this.views.find(view => view.value === this.currentView)?.label ?? '';
  }

  protected viewDescription(): string {
    return this.views.find(view => view.value === this.currentView)?.description ?? '';
  }

  protected categoryNames(user: RawMaterialUserAccess): string {
    if (user.categoryIds.length === this.categories.length) return 'Acesso a todas as categorias';
    return this.categories
      .filter(category => user.categoryIds.includes(category.id))
      .map(category => category.name)
      .join(', ') || 'Sem categorias';
  }

  protected useDefaultAvatar(event: Event): void {
    const image = event.target as HTMLImageElement;
    if (image.dataset['fallbackApplied']) return;
    image.dataset['fallbackApplied'] = 'true';
    image.src = 'assets/images/avatars/default.png';
  }

  private resolveAccess(): void {
    const roles = this.userService.getCurrentUser()?.roles.map(role => role.authority) ?? [];
    this.canSwitchViews = roles.includes('ROLE_ADMIN');
    this.isAdmin = this.canSwitchViews || roles.includes('ROLE_RAW_MATERIALS_ADMIN');
    if (this.isAdmin) this.currentView = 'admin';
    else if (roles.includes('ROLE_RAW_MATERIALS_CONSULTATION')) this.currentView = 'consultation';
    else this.currentView = 'operator';
  }

  private loadItems(): void {
    this.loadingTable = true;
    this.rawMaterialsService.query({
      page: this.currentPage - 1,
      size: this.itemsPerPage,
      search: this.currentSearch,
      category: this.currentCategory,
      allowedCategories: this.allowedCategoryNames(),
      status: this.currentStatus,
      inactive: this.showInactive,
      sortColumn: this.currentSort?.column,
      sortDirection: this.currentSort?.state,
    }).subscribe(result => {
      this.data = this.currentSort?.state === 'desc'
        ? [...result.content].reverse()
        : result.content;
      this.totalItems = result.totalElements;
      this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage) || 1;
      if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
      this.loadingTable = false;
      this.cdf.detectChanges();
    });
  }

  private loadSummary(): void {
    this.rawMaterialsService.getSummary().subscribe(summary => {
      this.summary = summary;
      this.cdf.detectChanges();
    });
  }

  private loadInventoryAccess(): void {
    const currentUser = this.userService.getCurrentUser();
    forkJoin({
      categories: this.rawMaterialsService.getCategories(),
      users: this.isAdmin
        ? this.rawMaterialsService.getUsers()
        : this.currentView === 'operator' && currentUser
          ? this.rawMaterialsService.getMyCategoryIds().pipe(map(categoryIds => [{
              id: currentUser.id,
              name: currentUser.name,
              pictureId: currentUser.pictureId ?? null,
              categoryIds,
            }]))
          : of([]),
    }).subscribe(({ categories, users }) => {
      this.categories = this.sortCategories(categories);
      this.users = users;
      this.selectDefaultCategory();
      this.loadItems();
      this.cdf.detectChanges();
    });
  }

  private currentOperatorAccess(): RawMaterialUserAccess | undefined {
    const currentUserId = this.userService.getCurrentUser()?.id;
    return this.users.find(user => user.id === currentUserId);
  }

  private allowedCategoryNames(): string[] | undefined {
    if (this.isAdmin || this.currentView !== 'operator') return undefined;
    const categoryIds = this.currentOperatorAccess()?.categoryIds ?? [];
    return this.categories
      .filter(category => categoryIds.includes(category.id))
      .map(category => category.name);
  }

  private selectDefaultCategory(): void {
    const category = this.categories.find(item => this.canAccessCategory(item));
    this.activeInventoryTab = category ? `category-${category.id}` : '';
    this.currentCategory = category?.name ?? '';
    this.showInactive = false;
  }

  private sortCategories(categories: RawMaterialCategory[]): RawMaterialCategory[] {
    return [...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    }));
  }

  private resolveErrorMessage(response: any): string {
    const body = response?.error;
    if (Array.isArray(body?.errors) && body.errors.length) {
      return body.errors.map((error: any) => error?.message).filter(Boolean).join(' ');
    }
    return body?.error || body?.message || response?.message || 'Não foi possível salvar a matéria-prima.';
  }

}

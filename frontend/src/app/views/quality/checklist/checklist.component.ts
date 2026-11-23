import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective, CardBodyComponent, CardComponent, ContainerComponent, DropdownComponent, DropdownItemDirective, DropdownItemPlainDirective, DropdownMenuDirective, DropdownToggleDirective } from '@coreui/angular';
import { ISorterValue, SmartPaginationComponent } from '@coreui/angular-pro';
import { ChecklistTableRow } from '../../../interface/checklist.interface';
import { ChecklistPreviewService } from '../../../services/checklist-preview.service';
import { BackNavigationService } from '../../../services/back-navigation.service';
import { ChecklistIconComponent } from '../../../../components/icons/checklist-icon/checklist-icon.component';
import { ChecklistTableComponent } from '../../../../components/table/checklist-table/checklist-table.component';
import { ChecklistCategoryModalComponent } from '../../../../components/modal/checklist/checklist-category-modal/checklist-category-modal.component';
import { ChecklistEquipmentModalComponent } from '../../../../components/modal/checklist/checklist-equipment-modal/checklist-equipment-modal.component';
import { ChecklistAccessModalComponent } from '../../../../components/modal/checklist/checklist-access-modal/checklist-access-modal.component';
import { ChecklistCatalogModalComponent } from '../../../../components/modal/checklist/checklist-catalog-modal/checklist-catalog-modal.component';
import { ChecklistNewRecordModalComponent } from '../../../../components/modal/checklist/checklist-new-record-modal/checklist-new-record-modal.component';
import { firstValueFrom, Subject, Subscription, debounceTime } from 'rxjs';
import { ChecklistCategoryTab, ChecklistHeader, ChecklistRecordCreate, ChecklistService } from '../../../services/checklist.service';
import { ToastrService } from '../../../services/toast.service';

type ChecklistView = 'admin' | 'operator' | 'consultation';

@Component({
  selector: 'app-checklist',
  imports: [
    CommonModule,
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    ButtonDirective,
    DropdownComponent,
    DropdownItemDirective,
    DropdownItemPlainDirective,
    DropdownMenuDirective,
    DropdownToggleDirective,
    SmartPaginationComponent,
    ChecklistIconComponent,
    ChecklistTableComponent,
    ChecklistCategoryModalComponent,
    ChecklistEquipmentModalComponent,
    ChecklistAccessModalComponent,
    ChecklistCatalogModalComponent,
    ChecklistNewRecordModalComponent,
  ],
  templateUrl: './checklist.component.html',
  styleUrl: './checklist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistComponent implements OnInit, OnDestroy {
  @ViewChild('categories') private categories!: ChecklistCategoryModalComponent;
  @ViewChild('equipmentModal') private equipmentModal!: ChecklistEquipmentModalComponent;
  @ViewChild('accessModal') private accessModal!: ChecklistAccessModalComponent;
  @ViewChild('catalogModal') private catalogModal!: ChecklistCatalogModalComponent;
  @ViewChild('newRecordModal') private newRecordModal!: ChecklistNewRecordModalComponent;

  protected readonly store = inject(ChecklistPreviewService);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly toaster = inject(ToastrService);
  private readonly api = inject(ChecklistService);
  protected readonly pageRows = signal<ChecklistTableRow[]>([]);
  protected readonly todoRows = signal<ChecklistTableRow[]>([]);
  protected readonly categoryTabs = signal<ChecklistCategoryTab[]>([]);
  protected readonly headerCount = signal<ChecklistHeader['headerCount'][number] | undefined>(undefined);
  private readonly headerError = signal(false);
  private readonly rowsError = signal(false);
  private readonly countsError = signal(false);
  private readonly todosError = signal(false);
  protected readonly pages = signal(0);
  protected readonly loadingRows = signal(false);
  protected readonly counts = signal<Record<string, number>>({});
  protected todoPage = 1;
  protected readonly todoPages = signal(0);
  protected readonly todoTotal = signal(0);
  private request?: Subscription;
  private todoRequest?: Subscription;
  private headerRequest?: Subscription;
  private countsRequest?: Subscription;
  private readonly searches = new Subject<void>();
  private readonly searchSubscription = this.searches.pipe(debounceTime(300)).subscribe(() => this.refreshRows());

  private categoryHistoryRegistered = false;
  private headerLoaded = false;
  protected readonly loadingCreation = signal(false);
  protected currentView: ChecklistView = 'consultation';
  protected readonly views: Array<{ value: ChecklistView; label: string }> = [
    { value: 'admin', label: 'Administrador' },
    { value: 'operator', label: 'Operador' },
    { value: 'consultation', label: 'Consulta' },
  ];
  protected categoryId = '';
  protected search = '';
  protected status = '';
  protected sorter: { column?: string; state?: 'asc' | 'desc' } = { column: 'updated', state: 'desc' };
  protected page = 1;
  protected itemsPerPage = 10;
  protected readonly reloading = signal(false);

  public ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.todoRequest?.unsubscribe();
    this.headerRequest?.unsubscribe();
    this.countsRequest?.unsubscribe();
    this.searchSubscription.unsubscribe();
    this.searches.complete();
  }

  protected refreshRows(): void {
    if (!this.headerLoaded) return;
    this.request?.unsubscribe();
    this.loadingRows.set(true);

    this.request = this.api.listRecordRows({
      page: this.page - 1, size: this.itemsPerPage, categoryId: this.activeCategoryId,
      search: this.search, status: this.status, sort: `${this.sorter.column || 'updated'},${this.sorter.state || 'desc'}`,
      consultation: this.currentView === 'consultation',
    }).subscribe({
      next: result => {
        this.pageRows.set(result.content);
        this.pages.set(result.totalPages);
        this.loadingRows.set(false);
        this.rowsError.set(false);
        if (this.page > Math.max(1, result.totalPages)) {
          this.page = Math.max(1, result.totalPages);
          this.refreshRows();
        }
      },
      error: () => {
        this.loadingRows.set(false);
        this.pageRows.set([]);
        this.pages.set(0);
        this.rowsError.set(true);
      },
    });
  }

  private loadCounts(): void {
    this.countsRequest?.unsubscribe();
    this.countsRequest = this.api.recordCounts(this.currentView === 'consultation').subscribe({
      next: counts => { this.counts.set(counts); this.countsError.set(false); },
      error: () => { this.counts.set({}); this.countsError.set(true); },
    });
  }

  protected loadHeader(refreshRecords = false): void {
    refreshRecords ||= !this.headerLoaded;
    this.headerRequest?.unsubscribe();
    this.reloading.set(true);
    if (refreshRecords) this.loadingRows.set(true);
    this.headerRequest = this.api.header().subscribe({
      next: header => {
        const previousCategory = this.activeCategoryId;
        this.categoryTabs.set(header.categories);
        this.headerLoaded = true;
        if (this.activeCategoryId !== previousCategory) this.page = 1;
        this.headerCount.set(header.headerCount[0]);
        this.headerError.set(false);
        this.reloading.set(false);
        if (refreshRecords) this.refreshRows();
      },
      error: () => {
        this.headerError.set(true);
        this.reloading.set(false);
        if (refreshRecords) this.loadingRows.set(false);
      },
    });
  }

  protected hasLoadError(): boolean {
    return this.headerError() || this.countsError() || this.rowsError() || this.todosError();
  }

  protected changeSearch(value: string): void {
    this.search = value; this.page = 1; this.request?.unsubscribe(); this.searches.next();
  }

  protected changeStatus(value: string): void {
    this.status = value; this.page = 1; this.refreshRows();
  }

  protected changeSort(value: ISorterValue): void {
    const state = value?.state;
    this.sorter = { column: value?.column, state: state === 'asc' || state === 'desc' ? state : undefined };
    this.page = 1;
    this.refreshRows();
  }

  protected changeSize(value: number): void {
    this.itemsPerPage = value; this.page = 1; this.refreshRows();
  }

  protected changePage(value: number): void {
    if (value !== this.page) { this.page = value; this.refreshRows(); }
  }

  protected loadTodos(page = 1): void {
    this.todoPage = page; this.todoRequest?.unsubscribe();

    this.todosError.set(false);
    if (this.currentView !== 'operator') return;

    this.todoRequest = this.api.listRecordRows({ page: page - 1, size: 10, actionable: true }).subscribe({
      next: result => { this.todoRows.set(result.content); this.todoPages.set(result.totalPages); this.todoTotal.set(result.totalElements); },
      error: () => { this.todoRows.set([]); this.todosError.set(true); },
    });
  }

  protected async openNewRecord(): Promise<void> {
    if (this.loadingCreation()) return;
    this.loadingCreation.set(true);
    try {
      const options = await firstValueFrom(this.api.creationOptions());
      this.newRecordModal?.open(options);
    } catch {
      this.toaster.warning('Não foi possível carregar os dados para criar o checklist.');
    } finally {
      this.loadingCreation.set(false);
    }
  }

  protected reload(): void {
    this.loadHeader(true);
    this.loadCounts();
    this.loadTodos();
  }

  protected categoriesChanged(): void {
    this.loadHeader(true);
    this.loadCounts();
  }

  public ngOnInit(): void {
    this.currentView = this.store.admin ? 'admin' : this.store.operator ? 'operator' : 'consultation';
    this.reload();
  }

  protected setView(view: ChecklistView): void {
    this.currentView = view;
    this.page = 1;
    this.refreshRows();
    this.loadCounts();
    this.loadTodos();
  }

  protected viewLabel(): string {
    return (this.views.find((item) => item.value === this.currentView)?.label ?? 'Consulta');
  }

  protected selectCategory(id: string): void {
    if (id && !this.categoryHistoryRegistered) {
      this.categoryHistoryRegistered = true;

      this.backNavigation.register(() => {
        this.categoryHistoryRegistered = false;
        this.categoryId = '';
        this.page = 1;
        this.refreshRows();
      });
    } else if (!id && this.categoryHistoryRegistered) {
      this.categoryHistoryRegistered = false;
      this.categoryId = '';
      this.page = 1;
      this.backNavigation.unregister();
      this.refreshRows();

      return;
    }

    this.categoryId = id;
    this.page = 1;
    this.refreshRows();
  }

  protected get activeCategoryId(): string {
    const categories = this.categoryTabs();
    return categories.some(category => category.id === this.categoryId) ? this.categoryId : categories[0]?.id ?? '';
  }

  protected count(categoryId: string): number {
    return this.counts()[categoryId] ?? 0;
  }

  protected clearFilters(): void {
    this.search = '';
    this.status = '';
    this.page = 1;
    this.refreshRows();
  }

  protected openRecord(id: string): void {
    void this.router.navigate(['/qualidade/checklist', id]);
  }

  protected openModels(): void {
    void this.router.navigate(['/qualidade/checklist/models']);
  }

  protected createRecord(event: ChecklistRecordCreate): void {
    this.backNavigation.runAfterOverlayClose(() => {
      void this.createAndOpenRecord(event);
    });
  }

  private async createAndOpenRecord(event: ChecklistRecordCreate): Promise<void> {
    try {
      const record = await this.store.createRecord(event);
      this.toaster.success('Registro criado com sucesso!');
      await this.router.navigate(['/qualidade/checklist', record.id, 'edit']);
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível criar o checklist.');
    }
  }
}

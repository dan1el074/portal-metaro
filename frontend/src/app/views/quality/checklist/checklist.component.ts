import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective, CardBodyComponent, CardComponent, ContainerComponent, DropdownComponent, DropdownItemDirective, DropdownItemPlainDirective, DropdownMenuDirective, DropdownToggleDirective } from '@coreui/angular';
import { SmartPaginationComponent } from '@coreui/angular-pro';
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
import { forkJoin, Subject, Subscription, debounceTime } from 'rxjs';
import { ChecklistRecordCreate, ChecklistService } from '../../../services/checklist.service';
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
  protected readonly todoRows = signal<Array<ChecklistTableRow & { order?: string }>>([]);
  protected readonly pages = signal(0);
  protected readonly loadingRows = signal(false);
  protected readonly counts = signal<Record<string, number>>({});
  protected todoPage = 1;
  protected readonly todoPages = signal(0);
  protected readonly todoTotal = signal(0);
  private request?: Subscription;
  private todoRequest?: Subscription;
  private readonly searches = new Subject<void>();
  private readonly searchSubscription = this.searches.pipe(debounceTime(300)).subscribe(() => this.refreshRows());

  private categoryHistoryRegistered = false;
  protected currentView: ChecklistView = 'consultation';
  protected readonly views: Array<{ value: ChecklistView; label: string }> = [
    { value: 'admin', label: 'Administrador' },
    { value: 'operator', label: 'Operador' },
    { value: 'consultation', label: 'Consulta' },
  ];
  protected categoryId = '';
  protected search = '';
  protected status = '';
  protected sorter: any = { column: 'updated', state: 'desc' };
  protected page = 1;
  protected itemsPerPage = 10;
  protected readonly reloading = signal(false);

  public ngOnDestroy(): void {
    this.request?.unsubscribe();
    this.todoRequest?.unsubscribe();
    this.searchSubscription.unsubscribe();
    this.searches.complete();
  }

  protected refreshRows(): void {
    this.request?.unsubscribe();
    this.loadingRows.set(true);

    this.request = forkJoin({
      rows: this.api.listRecordRows({ page: this.page - 1, size: this.itemsPerPage, categoryId: this.activeCategoryId,
        search: this.search, status: this.status, sort: `${this.sorter.column || 'updated'},${this.sorter.state || 'desc'}`,
        consultation: this.currentView === 'consultation' }),
      counts: this.api.recordCounts(this.currentView === 'consultation'),
    }).subscribe(
      {
        next: result => {
          this.pageRows.set(result.rows.content);
          this.pages.set(result.rows.totalPages);
          this.counts.set(result.counts);
          this.loadingRows.set(false);
          this.store.warning.set('');

          if (this.page > Math.max(1, result.rows.totalPages)) {
            this.page = Math.max(1, result.rows.totalPages);
            this.refreshRows();
          }
        },
        error: () => {
          this.loadingRows.set(false);
          this.pageRows.set([]);
          this.store.warning.set('Não foi possível carregar os checklists do servidor. Tente novamente.');
        }
      }
    );
  }

  protected changeSearch(value: string): void {
    this.search = value; this.page = 1; this.request?.unsubscribe(); this.searches.next();
  }

  protected changeStatus(value: string): void {
    this.status = value; this.page = 1; this.refreshRows();
  }

  protected changeSort(value: any): void {
    this.sorter = value; this.page = 1; this.refreshRows();
  }

  protected changeSize(value: number): void {
    this.itemsPerPage = value; this.page = 1; this.refreshRows();
  }

  protected changePage(value: number): void {
    if (value !== this.page) { this.page = value; this.refreshRows(); }
  }

  protected loadTodos(page = 1): void {
    this.todoPage = page; this.todoRequest?.unsubscribe();

    if (this.currentView !== 'operator') return;

    this.todoRequest = this.api.listRecordRows({ page: page - 1, size: 10, actionable: true }).subscribe({
      next: result => { this.todoRows.set(result.content); this.todoPages.set(result.totalPages); this.todoTotal.set(result.totalElements); },
      error: () => { this.todoRows.set([]); this.store.warning.set('Não foi possível carregar os checklists do servidor. Tente novamente.'); },
    });
  }

  protected async openNewRecord(): Promise<void> {
    try {
      await this.store.load(true); this.newRecordModal.open();
    } catch {
      this.toaster.warning('Não foi possível carregar os dados para criar o checklist.');
    }
  }

  protected async reload(): Promise<void> {
    if (this.reloading()) return;

    this.reloading.set(true);

    try {
      await this.store.load(true, true);
      this.refreshRows();
      this.loadTodos();
    } catch {
      /* The alert keeps the server error and allows another attempt. */
    } finally {
      this.reloading.set(false);
    }
  }

  public async ngOnInit(): Promise<void> {
    this.currentView = this.store.admin ? 'admin' : this.store.operator ? 'operator' : 'consultation';

    try {
      await this.store.load(false, true);
      this.refreshRows();
      this.loadTodos();
    } catch {
      /* The reload action retries configuration and records together. */
    }
  }

  protected setView(view: ChecklistView): void {
    this.currentView = view;
    this.page = 1;
    this.refreshRows();
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
    const categories = this.store.state().categories;
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
      this.toaster.success('Checklist criado. A identificação foi registrada e está bloqueada para o preenchimento.');
      await this.router.navigate(['/qualidade/checklist', record.id, 'edit']);
    } catch (error) {
      this.toaster.warning(error instanceof Error ? error.message : 'Não foi possível criar o checklist.');
    }
  }
}

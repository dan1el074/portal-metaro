import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, ViewChild, inject } from '@angular/core';
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
import { ChecklistRecordCreate } from '../../../services/checklist.service';
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
export class ChecklistComponent implements OnInit {
  @ViewChild('categories') private categories!: ChecklistCategoryModalComponent;
  @ViewChild('equipmentModal') private equipmentModal!: ChecklistEquipmentModalComponent;
  @ViewChild('accessModal') private accessModal!: ChecklistAccessModalComponent;
  @ViewChild('catalogModal') private catalogModal!: ChecklistCatalogModalComponent;
  @ViewChild('newRecordModal') private newRecordModal!: ChecklistNewRecordModalComponent;

  protected readonly store = inject(ChecklistPreviewService);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly toaster = inject(ToastrService);
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

  public async ngOnInit(): Promise<void> {
    await this.store.load();
    this.currentView = this.store.admin ? 'admin' : this.store.operator ? 'operator' : 'consultation';
  }

  protected setView(view: ChecklistView): void {
    this.currentView = view;
    this.page = 1;
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
      });
    } else if (!id && this.categoryHistoryRegistered) {
      this.categoryHistoryRegistered = false;
      this.categoryId = '';
      this.page = 1;
      this.backNavigation.unregister();
      return;
    }

    this.categoryId = id;
    this.page = 1;
  }

  protected get todos() {
    return this.store.state().records.filter((record) => {
      return this.store.editable(record);
    });
  }

  protected get rows(): ChecklistTableRow[] {
    const term = this.search.trim().toLocaleLowerCase();
    const rows = this.store
      .state()
      .records.filter((record) => this.store.visible(record))
      .filter((record) => this.currentView !== 'consultation' || record.status !== 'Rascunho')
      .map((record) => {
        const snapshot = this.store.snapshot(record);
        const flow = this.store.flow(record);
        return {
          id: record.id,
          number: this.store.state().records.findIndex((item) => item.id === record.id) + 1,
          title: this.store.title(record),
          category: snapshot.category.name,
          categoryId: snapshot.category.id,
          model: snapshot.template.name,
          equipment: snapshot.equipment,
          equipmentId: snapshot.template.equipmentId,
          serial: flow.serial,
          status: record.status,
          updated: record.updated,
        };
      })
      .filter((row) => {
        return (!this.categoryId || row.categoryId === this.categoryId) &&
        (!this.status || row.status === this.status) &&
        (!term || `${row.title} ${row.model} ${row.serial}`.toLocaleLowerCase().includes(term));
      });

    const column = this.sorter.column as keyof ChecklistTableRow | undefined;

    if (column) {
      return rows.sort((a, b) => {
        return String(a[column]).localeCompare(String(b[column])) * (this.sorter.state === 'asc' ? 1 : -1);
      });
    }
    return rows;
  }

  protected get pageRows(): ChecklistTableRow[] {
    return this.rows.slice(
      (this.page - 1) * this.itemsPerPage,
      this.page * this.itemsPerPage,
    );
  }

  protected get pages(): number {
    return Math.ceil(this.rows.length / this.itemsPerPage);
  }

  protected count(categoryId: string): number {
    return this.store.state().records.filter((record) => {
      return this.store.visible(record) && this.store.snapshot(record).category.id === categoryId
    }).length;
  }

  protected clearFilters(): void {
    this.search = '';
    this.status = '';
    this.page = 1;
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

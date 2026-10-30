import { BackNavigationService } from '../../../services/back-navigation.service';
import { ChecklistActionModalComponent } from '../../../../components/modal/checklist/checklist-action-modal/checklist-action-modal.component';
import { Subject, Observable, firstValueFrom, forkJoin, switchMap, takeUntil, catchError, EMPTY } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { ButtonDirective, CardBodyComponent, CardComponent, ContainerComponent, DropdownModule, ModalService } from '@coreui/angular';
import { ISorterValue } from '@coreui/angular-pro';
import { ChecklistIconComponent } from '../../../../components/icons/checklist-icon/checklist-icon.component';
import { SerialPlatesTableComponent } from '../../../../components/table/serial-plates-table/serial-plates-table.component';
import { SerialPlatesModalComponent } from '../../../../components/modal/serial-plates/serial-plates-modal/serial-plates-modal.component';
import { SerialPlatesHistoryModalComponent } from '../../../../components/modal/serial-plates/serial-plates-history-modal/serial-plates-history-modal.component';
import { SerialPlatesErpModalComponent } from '../../../../components/modal/serial-plates/serial-plates-erp-modal/serial-plates-erp-modal.component';
import { UserService } from '../../../services/user.service';
import { ToastrService } from '../../../services/toast.service';
import { SerialPlatesService } from '../../../services/serial-plates.service';
import { ReportPreviewService } from '../../../services/report-preview.service';
import { DEFAULT_SETTINGS, STATUSES, FIELD_LABELS, SERIAL_PLATES_REPORT_COLUMNS } from '../../../config/serial-plates.config';
import { ErpOrderItem, SerialPlateBatchFields, PlateHistory, PlatePatch, PlateSettings, SerialPlate, SerialPlateDialog, SerialPlateCreateDraft, SerialPlateQuery } from '../../../interface/serial-plates.interface';
import { ReportPreviewData } from '../../../interface/report-preview.interface';

@Component({
  selector: 'app-serial-plates',
  imports: [
    ChecklistActionModalComponent,
    CommonModule,
    ContainerComponent,
    CardComponent,
    ButtonDirective,
    CardBodyComponent,
    DropdownModule,
    ChecklistIconComponent,
    SerialPlatesTableComponent,
    SerialPlatesModalComponent,
    SerialPlatesHistoryModalComponent,
    SerialPlatesErpModalComponent
  ],
  templateUrl: './serial-plates.component.html',
  styleUrl: './serial-plates.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class SerialPlatesComponent implements OnDestroy {
  @ViewChild(ChecklistActionModalComponent) private relocationModal!: ChecklistActionModalComponent;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly data = inject(SerialPlatesService);
  private readonly reports = inject(ReportPreviewService);
  private readonly modals = inject(ModalService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly toaster = inject(ToastrService);
  private readonly user = inject(UserService).getCurrentUser();
  private readonly authorities = this.user?.roles.map(role => role.authority) ?? [];
  public readonly operator = this.authorities.some(role => ['ROLE_ADMIN', 'ROLE_SERIAL_PLATES_OPERATOR'].includes(role));
  public createDraft: SerialPlateCreateDraft = { quantity: 1, of: '', order: '', orderItem: '' };
  public view: 'operator' | 'consultation' = this.operator ? 'operator' : 'consultation';
  public records: SerialPlate[] = [];
  public totalElements = 0;
  public totalPages = 1;
  public totals: Record<string, number> = {};
  public busy = false;
  private readonly selectedRecords = new Map<string, SerialPlate>();
  private readonly refreshRequests = new Subject<void>();
  private readonly destroy = new Subject<void>();
  private destroyed = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  public settings = { ...DEFAULT_SETTINGS };
  public settingsDraft = { ...DEFAULT_SETTINGS };
  public selected = new Set<string>();
  private anchor: string | null = null;
  public search = '';
  public status = '';
  public page = 1;
  public perPage = 10;
  public sorter: ISorterValue = { column: 'serial', state: 'desc' };
  public dialog: SerialPlateDialog = '';
  public modalVisible = false;
  public confirmationVisible = false;
  public error = '';
  public edit: SerialPlate | null = null;
  private loadedOrder = '';
  private loadedOrderItem = '';
  public historyRecord: SerialPlate | null = null;
  public batch: PlatePatch = {};
  public batchOrderItems: ErpOrderItem[] = [];
  public batchFields: SerialPlateBatchFields = { of: false, order: false, readyStock: false, provider: false, status: false, manufactured: false, weight: false, voltage: false };
  private pending: (() => void) | null = null;
  private pendingRollback: (() => void) | null = null;
  private previousDialog: SerialPlateDialog = '';
  public confirmationCount = 0;
  public readonly views = [{ value: 'operator', label: 'Operador' }, { value: 'consultation', label: 'Consulta' }] as const;
  public readonly summaries = STATUSES.map((status, index) => ({
    status, title: status, color: ['#64748b', '#0369dd', '#7852b4', '#d99000', '#009966'][index],
  }));

  public constructor() {
    this.refreshRequests.pipe(
      switchMap(() => forkJoin({ page: this.data.findAll(this.query()), summary: this.data.summary() }).pipe(
        catchError(error => { this.showError(error); return EMPTY; })
      )), takeUntil(this.destroy)
    ).subscribe(({ page, summary }) => {
      this.records = page.content;
      this.totalElements = page.totalElements;
      this.totalPages = Math.max(1, page.totalPages);
      this.totals = summary;
      this.records.forEach(row => { if (this.selected.has(row.serial)) this.selectedRecords.set(row.serial, row); });
      if (this.page > this.totalPages) { this.page = this.totalPages; this.refresh(); }
      this.updateView();
    });
    this.data.settings().pipe(takeUntil(this.destroy)).subscribe({ next: settings => { this.settings = settings; this.updateView(); }, error: error => this.showError(error) });
    this.refresh();
  }

  private updateView(): void {
    if (!this.destroyed) this.changeDetector.markForCheck();
  }

  private refresh(): void {
    this.refreshRequests.next();
  }

  private request<T>(source: Observable<T>): Promise<T> {
    return firstValueFrom(source.pipe(takeUntil(this.destroy)));
  }

  private showError(error: unknown): void {
    if (this.destroyed) return;
    const http = error as HttpErrorResponse;
    this.error = http.error?.message || http.error?.error || (http.status === 409 ? 'Registro alterado por outro usuário. Reabra o registro.' : 'Não foi possível concluir a operação. Tente novamente.');
    this.toaster.warning(this.error);
    this.updateView();
  }

  public canEdit(): boolean {
    return this.operator && this.view === 'operator';
  }

  public providers(): string[] {
    return [...new Set(this.settings.providers.split('\n').map(value => value.trim()).filter(Boolean))];
  }

  public rows(): SerialPlate[] {
    return this.records;
  }

  public pages(): number {
    return this.totalPages;
  }

  public pageRows(): SerialPlate[] {
    return this.records;
  }

  public selectedRows(): SerialPlate[] {
    return [...this.selected].map(serial => this.selectedRecords.get(serial)).filter((row): row is SerialPlate => !!row);
  }

  public allSelected(): boolean {
    return this.pageRows().length > 0 && this.pageRows().every(row => this.selected.has(row.serial));
  }

  public someSelected(): boolean {
    return !this.allSelected() && this.pageRows().some(row => this.selected.has(row.serial));
  }

  public missing(): string[] {
    return this.data.reportMissing(this.selectedRows(), this.settings);
  }

  public historyEvents(): PlateHistory[] {
    return this.historyRecord?.history ?? [];
  }

  public dialogTitle(): string {
    return ({
      '': '', new: 'Criar números de série', edit: this.canEdit() ? 'Editar número de série' : 'Consultar número de série',
      batch: 'Atualizar em lote', settings: 'Configurações', report: 'Relatório de gravação'
    })[this.dialog];
  }

  public setView(value: 'operator' | 'consultation'): void {
    this.view = value;
    this.close();
  }

  public filter(): void {
    this.page = 1;
    this.clearSelection();
    this.anchor = null;
    this.refresh();
  }

  public clearFilters(): void {
    this.search = '';
    this.status = '';
    this.filter();
  }

  public setSearch(value: string): void {
    if (value !== this.search) {
      this.search = value;
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.page = 1;
      this.clearSelection();
      this.searchTimer = setTimeout(() => this.refresh(), 300);
    }
  }

  public sort(value: ISorterValue): void {
    if (value.column === this.sorter.column && value.state === this.sorter.state) return;

    this.sorter = value;
    this.page = 1;
    this.anchor = null;
    this.refresh();
  }

  public setPerPage(value: number): void {
    if (value === this.perPage) return;

    this.perPage = value;
    this.page = 1;
    this.anchor = null;
    this.refresh();
  }

  public setPage(page: number): void {
    this.page = page;
    this.refresh();
  }

  public async toggle(serial: string, event: MouseEvent): Promise<void> {
    const target = event.target as HTMLElement;
    const checked = target.tagName === 'INPUT' ? (target as HTMLInputElement).checked : !this.selected.has(serial);
    const query = JSON.stringify(this.query());
    try {
      const rows = event.shiftKey && this.anchor
        ? await this.request(this.data.range(this.anchor, serial, this.query()))
        : this.records.filter(row => row.serial === serial);
      if (query !== JSON.stringify(this.query())) return;
      const selected = new Set(this.selected);
      rows.forEach(row => { this.selectedRecords.set(row.serial, row); checked ? selected.add(row.serial) : selected.delete(row.serial); });
      this.selected = selected;
      this.anchor = serial;
    } catch (error) { this.showError(error); }
    finally { this.updateView(); }
  }

  public setReadyStock(checked: boolean): void {
    if (!this.canEdit() || !this.edit) return;
    this.edit.readyStock = checked;
  }

  public changeBatchOrder(value: string): void {
    this.batch.order = value;
    this.batch.orderItem = '';
    this.batchOrderItems = [];
  }

  public async loadBatchErp(): Promise<void> {
    if (!this.canEdit() || !this.batchFields.order || (this.batchFields.readyStock && this.batch.readyStock)) return;
    const batch = this.batch;
    const order = batch.order?.trim() ?? '';
    if (!order) return;
    this.batchOrderItems = [];
    this.batch.orderItem = '';
    try {
      const result = await this.request(this.data.searchOrder(order));
      if (this.batch === batch && this.batchFields.order && batch.order?.trim() === order
        && !(this.batchFields.readyStock && batch.readyStock)) this.batchOrderItems = result.items;
    } catch (error) { this.showError(error); }
    finally { this.updateView(); }
  }

  public async loadCreateOrder(): Promise<void> {
    const order = this.createDraft.order.trim();
    if (!this.canEdit() || !order) return;
    try { await this.request(this.data.searchOrder(order)); }
    catch (error) { this.showError(error); }
    finally { this.updateView(); }
  }

  public setBatchReadyStock(checked: boolean): void {
    this.batch.readyStock = checked;
    if (checked) {
      this.batchFields.order = false;
      this.batch.order = '';
      this.batch.orderItem = '';
      this.batchOrderItems = [];
    }
  }

  public reportRows(): string[][] {
    return this.selectedRows().map(row => [this.serialLabel(row.serial), row.description || '-', this.data.manufacturingLabel(row.manufactured),
    row.voltage || '-', this.settings.crea || '-', row.weight === null ? '-' : `${row.weight.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg`]);
  }

  public toggleAll(checked: boolean): void {
    const selected = new Set(this.selected);
    this.pageRows().forEach(row => { this.selectedRecords.set(row.serial, row); checked ? selected.add(row.serial) : selected.delete(row.serial); });
    this.selected = selected;
    this.anchor = null;
  }

  public open(dialog: SerialPlateDialog): void {
    this.error = '';

    if (['new', 'batch', 'settings', 'report'].includes(dialog) && !this.canEdit()) return;
    if (dialog === 'report') { this.openReport(); return; }

    if (dialog === 'new') {
      this.createDraft.quantity = 1;
      this.createDraft.of = '';
      this.createDraft.order = '';
      this.createDraft.orderItem = '';
    }

    if (dialog === 'batch') {
      this.batch = {};
      this.batchOrderItems = [];
      this.batchFields = { of: false, order: false, readyStock: false, provider: false, status: false, manufactured: false, weight: false, voltage: false };
    }

    if (dialog === 'settings') this.settingsDraft = { ...this.settings };

    this.dialog = dialog;
    this.modalVisible = true;
  }

  public async openEdit(record: SerialPlate): Promise<void> {
    try {
      const fresh = await this.request(this.data.findBySerial(record.serial));
      this.edit = { ...fresh, history: [] };
      this.loadedOrder = fresh.order;
      this.loadedOrderItem = fresh.orderItem;
      this.open('edit');
      if (fresh.order && this.canEdit()) this.data.searchOrder(fresh.order).pipe(takeUntil(this.destroy)).subscribe({ next: () => this.updateView(), error: () => {} });
    } catch (error) { this.showError(error); }
    finally { this.updateView(); }
  }

  public openHistory(): void {
    if (!this.edit) return;
    this.historyRecord = { ...this.edit, history: [] };
    const record = this.historyRecord;
    this.data.history(record.serial).pipe(takeUntil(this.destroy)).subscribe({
      next: history => {
        if (this.historyRecord === record) this.historyRecord = { ...record, history };
        this.updateView();
      }, error: error => this.showError(error)
    });
  }

  public close(): void {
    this.modalVisible = false;
    this.error = '';
    this.pending = null;
    this.pendingRollback = null;
  }

  public selectStatus(status: string): void {
    this.status = this.status === status ? '' : status;
    this.filter();
  }

  public countStatus(status: string): number {
    return this.totals[status || 'total'] ?? 0;
  }

  public serialLabel(value: string): string {
    return value.replace(/^0+(?=\d)/, '');
  }

  private finish(message: string): void {
    this.close();
    this.refresh();
    this.toaster.success(message);
  }

  private confirm(count: number, action: () => void, rollback: (() => void) | null = null): void {
    this.previousDialog = this.dialog;
    this.confirmationCount = count;
    this.pending = action;
    this.pendingRollback = rollback;
    this.error = '';
    this.confirmationVisible = true;
    this.modals.toggle({ id: 'serialPlateErpModal', show: true });
  }

  public cancelErp(): void {
    this.pendingRollback?.();
    this.pendingRollback = null;
    this.pending = null;
    this.confirmationVisible = false;
    this.modals.toggle({ id: 'serialPlateModal', show: true });
  }

  public confirmErp(): void {
    if (!this.canEdit()) return;

    const action = this.pending;
    this.pending = null;
    this.pendingRollback = null;
    this.confirmationVisible = false;
    this.dialog = this.previousDialog;
    this.modals.toggle({ id: 'serialPlateModal', show: true });

    action?.();
  }

  public changeEditOrder(value: string): void {
    if (!this.canEdit() || !this.edit || this.edit.readyStock) return;

    if (value !== this.edit.order) {
      this.edit.order = value;
      this.edit.orderItem = '';
    }
  }

  private async erp(order: string, itemId = ''): Promise<PlatePatch | null> {
    const result = await this.request(this.data.searchOrder(order));
    const item = itemId ? result.items.find(item => item.id === itemId) : result.items[0];
    if (!item) { this.toaster.warning('Selecione um item válido do pedido.'); return null; }
    return { client: result.client, orderItem: item.id, description: item.description, capacity: item.capacity, voltage: item.voltage, weight: item.weight };
  }

  public async create(): Promise<void> {
    if (!this.canEdit() || this.busy) return;
    if (!Number.isInteger(this.createDraft.quantity) || this.createDraft.quantity < 1 || this.createDraft.quantity > 500 || !this.createDraft.of.trim()) {
      this.error = 'Informe a OF e uma quantidade inteira entre 1 e 500.';
      return;
    }
    this.busy = true;
    try {
      const created = await this.request(this.data.create(this.createDraft));
      this.clearFilters();
      this.finish(`${created.length} número(s) de série criado(s).`);
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.updateView(); }
  }

  public async loadErp(itemId?: string): Promise<void> {
    if (!this.canEdit() || !this.edit || this.edit.readyStock || this.busy) return;
    const record = this.edit;
    const previousItem = record.orderItem;
    const order = record.order.trim();
    this.busy = true;
    try {
      const values = await this.erp(order, itemId ?? record.orderItem);
      if (!values || this.edit !== record || record.order.trim() !== order || record.readyStock) return;
      const rollback = () => record.orderItem = previousItem;
      const apply = () => {
        Object.assign(record, values, { order });
        this.loadedOrder = order;
        this.loadedOrderItem = record.orderItem;
      };
      if (this.data.hasEquipmentData(record)) this.confirm(1, apply, rollback);
      else apply();
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.updateView(); }
  }

  public async saveEdit(): Promise<void> {
    if (!this.canEdit() || !this.edit || this.busy) return;
    const record = this.edit;
    const patch = this.data.editPatch(record);
    if (patch.order && (patch.order !== this.loadedOrder || patch.orderItem !== this.loadedOrderItem)) {
      this.busy = true;
      try {
        const values = await this.erp(patch.order, patch.orderItem);
        if (!values) return;
        const apply = () => this.commit([record], { ...patch, ...values }, false);
        if (this.data.hasEquipmentData(patch)) this.confirm(1, () => { void apply(); });
        else { this.busy = false; await apply(); }
      } catch (error) { this.showError(error); }
      finally { this.busy = false; this.updateView(); }
    } else await this.commit([record], patch, false);
  }

  public async saveBatch(): Promise<void> {
    if (!this.canEdit() || !this.selected.size || this.busy) return;
    const patch = this.data.batchPatch(this.batch, this.batchFields);
    if (!Object.keys(patch).length) { this.error = 'Marque pelo menos um campo para atualizar.'; return; }
    if (patch.order?.trim()) {
      if (!this.batchOrderItems.length || !patch.orderItem) { this.error = 'Busque o pedido e selecione um item.'; return; }
      this.busy = true;
      try {
        const values = await this.erp(patch.order, patch.orderItem);
        if (!values) return;
        const rows = await this.request(this.data.selection([...this.selected]));
        const apply = () => this.commit(rows, { ...patch, ...values, ...(this.batchFields.weight ? { weight: patch.weight } : {}), ...(this.batchFields.voltage ? { voltage: patch.voltage } : {}) }, true);
        const affected = rows.filter(row => this.data.hasEquipmentData(row)).length;
        if (affected) this.confirm(affected, () => { void apply(); });
        else { this.busy = false; await apply(); }
      } catch (error) { this.showError(error); }
      finally { this.busy = false; this.updateView(); }
    } else await this.commit(this.selectedRows(), patch, true);
  }

  private async commit(records: SerialPlate[], patch: PlatePatch, batch: boolean): Promise<void> {
    if (this.busy || !this.canEdit()) return;
    this.busy = true;
    try {
      const impacts = 'order' in patch || 'readyStock' in patch
        ? await this.request(this.data.relocationImpact(records, patch)) : [];
      let confirmed = false;
      if (impacts.length) {
        const modalWasVisible = this.modalVisible;
        const details = impacts.map(impact => `Série ${impact.serial} → ${impact.order ? 'pedido ' + impact.order : 'Pronta Entrega'} (fluxo(s) ${impact.stepFlows.join(', ')})`).join('; ');
        // Consume the edit modal's history entry before registering the confirmation.
        // Otherwise its asynchronous popstate closes the new modal instead.
        confirmed = !!await new Promise<string | null>(resolve => {
          this.backNavigation.runAfterOverlayClose(() => {
            if (this.destroyed) { resolve(null); return; }
            void this.relocationModal.open({
              title: 'Confirmar realocação de equipamento',
              message: `${details}. O vínculo com o Fluxo de Etapas anterior será removido e a realocação será registrada nos comentários da etapa atual. A etapa, o status, as quantidades e os demais equipamentos serão preservados. Deseja continuar?`,
              confirmLabel: 'Confirmar realocação',
            }).then(resolve);
          });
          this.modalVisible = false;
          this.changeDetector.detectChanges();
        });
        if (this.destroyed) return;
        await new Promise<void>(resolve => this.backNavigation.runAfterOverlayClose(() => {
          if (!this.destroyed) {
            this.modalVisible = modalWasVisible;
            this.changeDetector.detectChanges();
          }
          resolve();
        }));
        if (this.destroyed) return;
        if (!confirmed) return;
      }
      const response = await this.request(this.data.update(records, patch, batch, confirmed));
      const updated = Array.isArray(response) ? response : [response];
      const selected = new Set(this.selected);
      updated.forEach(row => {
        const term = this.search.trim().toLocaleLowerCase('pt-BR');
        const matches = (!this.status || row.status === this.status) && (!term ||
          (row.readyStock && 'pe pronta entrega'.includes(term)) ||
          [...Object.keys(FIELD_LABELS), 'serial'].some(key => String(row[key as keyof SerialPlate] ?? '').toLocaleLowerCase('pt-BR').includes(term)));
        if (!matches) selected.delete(row.serial);
        this.selectedRecords.set(row.serial, row);
      });
      this.selected = selected;
      this.finish('Registro(s) atualizado(s).');
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.updateView(); }
  }

  public async saveSettings(): Promise<void> {
    if (!this.canEdit() || this.busy) return;
    this.busy = true;
    try {
      this.settings = await this.request(this.data.saveSettings(this.settingsDraft));
      this.finish('Configurações atualizadas.');
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.updateView(); }
  }

  private async openReport(): Promise<void> {
    if (!this.canEdit() || !this.selected.size || this.busy) return;
    this.busy = true;
    try {
      // Load authoritative records even when incomplete, so the existing warning list remains available.
      const rows = await this.request(this.data.selection([...this.selected]));
      rows.forEach(row => this.selectedRecords.set(row.serial, row));
      this.settings = await this.request(this.data.settings());
      this.dialog = 'report';
      this.modalVisible = true;
    } catch (error) { this.showError(error); }
    finally { this.busy = false; this.updateView(); }
  }

  public async printReport(): Promise<void> {
    if (!this.canEdit() || !this.selected.size || this.missing().length || this.busy) return;
    const preview = window.open('', '_blank');
    if (!preview) { this.error = 'Permita a abertura da janela de impressão no navegador.'; return; }
    this.busy = true;
    try {
      const report = await this.request(this.data.report([...this.selected]));
      report.records.forEach(row => this.selectedRecords.set(row.serial, row));
      this.settings = report.settings;
      this.reports.open(this.reportData(), preview);
    } catch (error) { preview.close(); this.showError(error); }
    finally { this.busy = false; this.updateView(); }
  }

  public ngOnDestroy(): void {
    this.destroyed = true;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.destroy.next();
    this.destroy.complete();
    this.pending = null;
  }

  public clearSelection(): void {
    this.selected = new Set();
    this.selectedRecords.clear();
    this.anchor = null;
  }

  public reportData(): ReportPreviewData {
    return {
      title: 'Relatório de gravação', previewTitle: 'Metaro · Relatório de gravação',
      subtitle: 'Plaquetas de identificação dos equipamentos', brandName: 'Metaro',
      logoUrl: new URL('assets/images/brand/default-logo.svg', document.baseURI).href,
      footerText: 'Metaro · Controle de números de série e plaquetas', itemLabel: 'plaqueta(s)',
      fileNamePrefix: 'relatorio-plaquetas', columns: SERIAL_PLATES_REPORT_COLUMNS, columnWidths: [11, 30, 18, 15, 15, 11],
      rows: this.reportRows(), metadata: ['CREA: ' + this.settings.crea], instructions: this.settings.instructions
    };
  }

  private query(): SerialPlateQuery {
    return {
      page: this.page - 1, size: this.perPage, search: this.search, status: this.status,
      sortColumn: (this.sorter.column || 'serial') as keyof SerialPlate, sortDirection: this.sorter.state === 'desc' ? 'desc' : 'asc'
    };
  }
}

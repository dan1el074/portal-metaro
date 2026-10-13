import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, OnInit, ViewChild, ChangeDetectionStrategy, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { ToastrService } from '../../../services/toast.service';
import { ButtonDirective, CardBodyComponent, CardComponent, ContainerComponent, DropdownComponent, DropdownDividerDirective, DropdownItemDirective, DropdownItemPlainDirective, DropdownMenuDirective, DropdownToggleDirective } from '@coreui/angular';
import { IItem, SmartPaginationComponent } from '@coreui/angular-pro';
import { UserService } from './../../../services/user.service';
import { StepFlowService } from './../../../services/step-flow.service';
import { Me } from '../../../interface/user.interface';
import { Resume, Step, AdminDashboard, StepFlowData, StepFlowOrderInfo } from '../../../interface/step-flow.interface';
import { TruncatePipe } from '../../../pipes/truncate.pipe';
import { StepFlowTableComponent } from './../../../../components/table/step-flow-table/step-flow-table.component';
import { StepFlowOffcanvasComponent } from '../../../../components/offcanvas/step-flow-offcanvas/step-flow-offcanvas.component';
import { StepFlowInputOffcanvasComponent } from '../../../../components/offcanvas/step-flow-input-offcanvas/step-flow-input-offcanvas.component';
import { NewStepFlowModalComponent } from '../../../../components/modal/step-flow/new-step-flow-modal/new-step-flow-modal.component';

interface StepFlowView extends Step {
  type: 'profile' | 'sector';
  roleAuthority?: string;
  activated: boolean;
}

@Component({
  selector: 'app-step-flow',
  imports: [
    ContainerComponent,
    CardComponent,
    CardBodyComponent,
    StepFlowTableComponent,
    StepFlowOffcanvasComponent,
    DropdownComponent,
    DropdownItemDirective,
    DropdownMenuDirective,
    DropdownToggleDirective,
    DropdownItemPlainDirective,
    DropdownDividerDirective,
    StepFlowInputOffcanvasComponent,
    ButtonDirective,
    TruncatePipe,
    SmartPaginationComponent,
    NewStepFlowModalComponent,
    TruncatePipe
  ],
  templateUrl: './step-flow.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './step-flow.component.scss',
})
export class StepFlowComponent implements OnInit, AfterViewInit {
  @ViewChild('stepFlowOffcanvas')stepFlowOffcanvas!: StepFlowOffcanvasComponent;
  @ViewChild('stepFlowInputOffcanvas')stepFlowInputOffcanvas!: StepFlowInputOffcanvasComponent;

  protected isAdmin: boolean = false;
  protected hasConsultationAccess: boolean = false;
  protected showMoney: boolean = true;
  protected isShipping: boolean = false;
  protected data!: Array<StepFlowData>;
  protected currentStepData!: Array<StepFlowData>;
  protected resume!: Array<Resume>;
  protected steps!: Array<Step>;
  protected views!: Array<StepFlowView>;
  protected dashboard!: AdminDashboard;
  protected currentStepIndex: number = - 1;
  protected loading: boolean = true;
  protected showNewModal: boolean = false;
  protected workQueueSearch: string = '';
  private user!: Me | null;

  //smart table
  protected dataTable!: Array<IItem>;
  protected currentSearch?: string;
  protected totalItems = 0;
  protected loadingTable = false;
  protected currentPage = 1;
  protected totalPages = 1;
  protected currentStepFilter?: string;
  private itemsPerPage = 10;
  private currentSort?: { column: string; state: 'asc' | 'desc' };
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private stepFlowService: StepFlowService,
    private userService: UserService,
    private sanitizer: DomSanitizer,
    private toaster: ToastrService,
    private cdf: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  public ngOnInit(): void {
    this.resume = [
      {
        id: 1,
        title: "Total de pedidos",
        description: "todos os registros",
        color: "#314158",
        value: 0,
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#314158" stroke-width="1.8"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg>`),
      },
      {
        id: 2,
        title: "Concluídos",
        description: "entregues com sucesso",
        color: "#009966",
        value: 0,
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#009966" stroke-width="1.8"><path d="M18 6 7 17l-5-5"></path><path d="m22 10-7.5 7.5L13 16"></path></svg>`),
      },
      {
        id: 3,
        title: "Em andamento",
        description: "em processamento",
        color: "#0369dd",
        value: 0,
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0369dd" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`),
      },
      {
        id: 4,
        title: "Atrasados",
        description: "fora do prazo",
        color: "#c5232a",
        value: 0,
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c5232a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16h.01"></path><path d="M12 8v4"></path><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"></path></svg>`),
      },
    ];

    this.steps = [
      {
        id: 0,
        title: "Consulta",
        description: '',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.06 12.35a1 1 0 0 1 0-.7C3.78 7.6 7.7 5 12 5c4.3 0 8.22 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.22 16.4 16.3 19 12 19c-4.3 0-8.22-2.6-9.94-6.65"></path><circle cx="12" cy="12" r="3"></circle></svg>`),
        count: 0,
        lateCount: 0
      },
      {
        id: 1,
        title: 'Montagem Final',
        description: 'Produção e montagem do produto',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>`),
        count: 0,
        lateCount: 0
      },
      {
        id: 2,
        title: 'PCP',
        description: 'Planejamento e controle da produção',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7h-9"></path><path d="M14 17H5"></path><circle cx="17" cy="17" r="3"></circle><circle cx="7" cy="7" r="3"></circle></svg>`),
        count: 0,
        lateCount: 0
      },
      {
        id: 3,
        title: 'Frete',
        description: 'Cotação e contratação do transporte',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path><path d="M15 18H9"></path><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"></path><circle cx="17" cy="18" r="2"></circle><circle cx="7" cy="18" r="2"></circle></svg>`),
        count: 0,
        lateCount: 0
      },
      {
        id: 4,
        title: 'Faturamento',
        description: 'Emissão de nota fiscal',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"></path><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path><path d="M12 17.5v-11"></path></svg>`),
        count: 0,
        lateCount: 0
      },
      {
        id: 5,
        title: 'Expedição',
        description: 'Separação e despacho do pedido',
        icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m16 16 2 2 4-4"></path><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"></path><path d="m7.5 4.27 9 5.15"></path><polyline points="3.29 7 12 12 20.71 7"></polyline><line x1="12" x2="12" y1="22" y2="12"></line></svg>`),
        count: 0,
        lateCount: 0
      },
    ];

    this.user = this.userService.getCurrentUser();
    this.views = this.buildViews();
    this.getStepAccess();
    this.loadOrders();

    if (this.hasConsultationAccess) this.loadDashboard();
    this.loadCurrentSectorOrders();
  }

  public ngAfterViewInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const orderId = Number(params.get('orderId'));
      if (Number.isInteger(orderId) && orderId > 0) queueMicrotask(() => this.openOrder(orderId));
    });
  }

  public openOrder(orderId: number) {
    this.stepFlowOffcanvas.open(orderId);
  }

  protected setCurrentStepIndex(index: number): void {
    const view = this.views[index];
    const canTransition = this.isAdmin || (this.isShipping && this.isShippingView(view));
    if (!canTransition || !view?.activated) return;

    this.currentStepData = [];
    this.workQueueSearch = '';
    this.currentStepIndex = index;

    if (view.roleAuthority === 'ROLE_STEP_FLOW_CONSULTATION') this.loadDashboard();
    if (view.type === 'sector') this.loadCurrentStepOrders(view.id - 1);
  }

  protected searchForStatus(term: string): void {
    let text = term.toLowerCase();

    if (text == 'total de pedidos') {
      this.onClearAll();
      return;
    }

    if (text == 'concluídos') text = 'concluído'
    if (text == 'em andamento') text = 'andamento'
    if (text == 'atrasados') text = 'atrasado'

    this.currentSearch = text;
    this.currentPage = 1;
    this.loadOrders();
  }

  protected toggleNewModal(status: boolean): void {
    this.showNewModal = status;
  }

  protected createNewOrder(order: StepFlowOrderInfo): void {
    this.toggleNewModal(false);
    this.createOrder(order, false);
  }

  protected createLegacyOrder(order: StepFlowOrderInfo): void {
    this.toggleNewModal(false);
    this.createOrder(order, true);
  }

  private createOrder(order: StepFlowOrderInfo, legacy: boolean): void {
    this.stepFlowService.create(order, legacy).subscribe({
      next: () => {
        this.toaster.success("Registro criado com sucesso!");
        this.loadOrders();
        this.loadCurrentSectorOrders();
      },
      error: error => {
        const message = error.error?.error || 'Não foi possível criar o registro.';
        this.toaster.error(message);
      }
    });
  }

  private loadDashboard(): void {
    this.stepFlowService.getDashboard().subscribe({
        next: (data: AdminDashboard) => {
          this.dashboard = data;
          this.resume[0].value = data.totalCount;
          this.resume[1].value = data.progressCount;
          this.resume[2].value = data.completeCount;
          this.resume[3].value = data.lateCount;

          for (let i: number = 0; i<data.stepsCount.length; i++) {
            this.steps[i + 1].count = data.stepsCount[i];
            this.steps[i + 1].lateCount = data.stepsLateCount?.[i] ?? 0;
          }

          this.cdf.detectChanges();
        },
        error: () => this.toaster.error("Erro ao recuperar informações de consulta")
      });
  }

  private loadCurrentStepOrders(index: number): void {
    this.loading = true;

    this.stepFlowService.findAllFromCurrentStep(index).subscribe({
      next: (data: Array<StepFlowData>) => {
        this.currentStepData = data;
        this.loading = false;
        this.cdf.detectChanges();
      },
      error: () => this.toaster.error("Erro ao buscar informações!")
    });
  }

  public openCurrentStepOrder(orderId: number) {
    this.stepFlowInputOffcanvas.open(orderId);
  }

  protected get filteredCurrentStepData(): Array<StepFlowData> {
    const search = this.normalizeSearchValue(this.workQueueSearch);

    if (!search) return this.currentStepData ?? [];

    return (this.currentStepData ?? []).filter(item =>
      [
        item.number,
        item.quantity,
        item.client,
        item.dueDate,
        item.status
      ].some(value => this.normalizeSearchValue(value).includes(search))
    );
  }

  protected onWorkQueueSearch(event: Event): void {
    this.workQueueSearch = (event.target as HTMLInputElement).value;
  }

  protected clearWorkQueueSearch(): void {
    this.workQueueSearch = '';
  }

  private getStepAccess(): void {
    if (!this.user) {
      this.toaster.error("Erro ao ler dados do usuário");
      this.currentStepIndex = -1;
      return;
    }

    this.isAdmin = this.hasActiveRole('ROLE_ADMIN');

    if (!this.isAdmin && this.hasActiveRole('ROLE_STEP_FLOW_ADMIN')) {
      this.currentStepIndex = this.views.findIndex(
        view => view.roleAuthority === 'ROLE_STEP_FLOW_ADMIN'
      );
      return;
    }

    if (this.hasActiveRole('ROLE_STEP_FLOW_CONSULTATION')) {
      this.hasConsultationAccess = true;
      this.currentStepIndex = this.views.findIndex(
        view => view.roleAuthority === 'ROLE_STEP_FLOW_CONSULTATION'
      );
      return;
    }

    if (!this.hasActiveRole('ROLE_STEP_FLOW_OPERATOR')) {
      this.currentStepIndex = -1;
      return;
    }

    switch (this.user.position) {
      case 'Montagem Final':
        this.currentStepIndex = this.views.findIndex(view => view.title == 'Montagem Final');
        this.showMoney = false;
        break;
      case 'PCP':
        this.currentStepIndex = this.views.findIndex(view => view.title == 'PCP');
        break;
      case 'Comercial':
        this.currentStepIndex = this.views.findIndex(view => view.title == 'Frete');
        break;
      case 'Financeiro':
        this.currentStepIndex = this.views.findIndex(view => view.title == 'Faturamento');
        break;
      case 'Almoxarifado':
        this.currentStepIndex = this.views.findIndex(view => view.title == 'Expedição');
        this.isShipping = true;
        break;
      default:
        this.currentStepIndex = -1;
    }
  }

  private loadOrders(): void {
    this.loadingTable = true;

    this.stepFlowService.findAll(
      this.currentPage-1,
      this.itemsPerPage,
      this.currentSort?.column,
      this.currentSort?.state,
      this.currentSearch,
      this.currentStepFilter
    ).subscribe({
      next: (result) => {
        let data = result;

        if (this.currentSort?.state == 'desc') data.content.reverse();

        this.dataTable = data?.content ?? [];
        this.totalItems = data?.totalElements ?? 0;
        this.totalPages = Math.ceil(this.totalItems / this.itemsPerPage) || 1;
        this.loadingTable = false;
        this.cdf.detectChanges();
      },
      error: () => {
        this.toaster.error('Erro ao buscar informações!');
        this.loadingTable = false;
      },
    });
  }

  protected reloadOrders(): void {
    this.loadCurrentSectorOrders();
    this.loadOrders();
  }

  protected onNextStep(id: number) {
    this.currentStepData = this.currentStepData.filter(step => step.id !== id);
    this.cdf.detectChanges();
    this.loadOrders();
  }

  protected onPageChange(page: number): void {
    this.currentPage = page;
    this.loadOrders();
  }

  protected onSorterChange(sorter: any): void {
    this.currentSort = sorter?.state ? sorter?.column ? { column: sorter?.column, state: sorter.state } : undefined : undefined;
    this.currentPage = 1;
    this.loadOrders();
  }

  protected onItemsPerPageChange(itemsNumber: number): void {
    this.itemsPerPage = itemsNumber;
    this.loadOrders();
  }

  protected onFilterChange(value: string): void {
    this.currentSearch = value;
    this.currentPage = 1;
    this.loadOrders();
  }

  protected onStepFilterChange(step: string): void {
    this.currentStepFilter = step || '';
    this.currentPage = 1;
    this.loadOrders();
  }

  public filterByStep(step: string): void {
    this.currentStepFilter = step;
    this.currentPage = 1;
    this.loadOrders();
  }

  protected onClearAll(): void {
    this.currentSearch = undefined;
    this.currentSort = undefined;
    this.currentStepFilter = '';
    this.currentPage = 1;
    this.loadOrders();
  }

  private buildViews(): Array<StepFlowView> {
    const consultationView: StepFlowView = {
      ...this.steps[0],
      type: 'profile',
      roleAuthority: 'ROLE_STEP_FLOW_CONSULTATION',
      activated: this.hasActiveRole('ROLE_STEP_FLOW_CONSULTATION'),
    };

    const administratorView: StepFlowView = {
      id: -1,
      title: 'Administrador',
      description: 'Perfil reservado para uso futuro',
      icon: this.sanitizer.bypassSecurityTrustHtml(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>`),
      count: 0,
      lateCount: 0,
      type: 'profile',
      roleAuthority: 'ROLE_STEP_FLOW_ADMIN',
      activated: this.hasActiveRole('ROLE_STEP_FLOW_ADMIN'),
    };

    const sectorViews = this.steps.slice(1).map<StepFlowView>(step => ({
      ...step,
      type: 'sector',
      activated: true,
    }));

    return [consultationView, administratorView, ...sectorViews];
  }

  private hasActiveRole(authority: string): boolean {
    return this.user?.roles.some(role => role.authority === authority && role.activated) ?? false;
  }

  private loadCurrentSectorOrders(): void {
    const view = this.views[this.currentStepIndex];
    if (view?.type === 'sector') this.loadCurrentStepOrders(view.id - 1);
  }

  protected isShippingView(view: StepFlowView | undefined): boolean {
    return view?.type === 'sector'
      && (view.title === 'Montagem Final' || view.title === 'Expedição');
  }

  private normalizeSearchValue(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('pt-BR')
      .trim();
  }
}

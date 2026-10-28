import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ButtonDirective, ColComponent, ContainerComponent, FormCheckComponent, FormCheckInputDirective, FormCheckLabelDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, ProgressComponent, RowComponent } from '@coreui/angular';
import { distinctUntilChanged, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastrService } from '../../../../services/toast.service';
import { AuthGuard } from '../../../../config/auth.guard';
import { MemorandoService } from './../../../../services/memorando.service';
import { NotificationWebSocketService } from '../../../../services/websocket.service';
import { ErrorService } from '../../../../services/error.service';
import { Position } from '../../../../interface/position.interface';
import { Me, UserSummary } from '../../../../interface/user.interface';
import { SignatureList, Memorando, MemorandoNavigation, NewMemorando, UpdateDepartmentMemorando } from '../../../../interface/memorando.interface';
import { ModalBackNavigationDirective } from '../../../../directive/modal-back-navigation.directive';

@Component({
  selector: 'app-document-view',
  imports: [
    CommonModule,
    ContainerComponent,
    RowComponent,
    ColComponent,
    FormCheckComponent,
    FormCheckInputDirective,
    FormCheckLabelDirective,
    ButtonDirective,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    RouterLink,
    ProgressComponent
  ],
  templateUrl: './document-view.component.html',
  styleUrl: './document-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentViewComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  protected user!: Me;
  protected signatures: Array<SignatureList> = [];
  protected signaturesMissing: Array<UserSummary> = [];
  protected navigation: MemorandoNavigation = { previousId: null, nextId: null };
  protected loading = true;
  protected isAdmin: boolean = false;
  protected canSign: boolean = false;
  protected showSignModal: boolean = false;
  protected showRollbackModal: boolean = false;
  protected showPublishModal: boolean = false;
  protected showCancelModal: boolean = false;
  protected showDeleteModal: boolean = false;
  protected showUpdateDepartmentModal: boolean = false;
  protected manangerAlert!: { user: UserSummary, department: Position } | null;
  protected item: Memorando = {
    id: 0,
    number: 0,
    request: 0,
    erpSource: 'PROBUS',
    client: '',
    items: [],
    title: '',
    description: '',
    reason: '',
    createAt: '',
    user: {
      id: 0,
      name: '',
      position: {
        id: 0,
        name: ''
      },
      picture: null
    },
    signatures: [],
    fromDepartments: [],
    status: '',
    logs: []
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private websocket: NotificationWebSocketService,
    private memorandoService: MemorandoService,
    private toasterService: ToastrService,
    private errorService: ErrorService,
    private authGuardService: AuthGuard,
    private cdr: ChangeDetectorRef
  ) { }

  public ngOnInit(): void {
    this.authGuardService.getUser().subscribe({
      next: user => {
        this.user = user;
        this.isAdmin = user.roles.some(role => role.authority === 'ROLE_ADMIN');

        this.route.paramMap.pipe(
          map(params => Number(params.get('id'))),
          distinctUntilChanged(),
          takeUntilDestroyed(this.destroyRef),
        ).subscribe(id => this.loadMemorando(id));
      },
      error: () => this.toasterService.error('Erro ao buscar informações do usuário!'),
    });
  }

  protected printPage(): void {
    window.print();
  }

  protected navigateTo(id: number | null): void {
    if (id == null) return;
    this.router.navigate(['/general/memorando', id]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected get signedCount(): number {
    if (this.item.status === 'CREATED') return 0;
    return this.signatures.filter(signature => signature.check || this.item.status === 'APPROVED').length;
  }

  protected get signatureProgress(): number {
    if (!this.signatures.length) return 0;
    return Math.round((this.signedCount / this.signatures.length) * 100);
  }

  protected statusLabel(): string {
    switch (this.item.status) {
      case 'CREATED': return 'Rascunho';
      case 'PUBLISH': return 'Ativo';
      case 'APPROVED': return 'Aprovado';
      case 'CANCELED': return 'Cancelado';
      default: return 'Indefinido';
    }
  }

  protected parseItem(value: string): { code: string; description: string } {
    const match = /^\s*(.+?)\s+-\s+(.+?)\s*$/.exec(value);

    return match
      ? { code: match[1], description: match[2] }
      : { code: '—', description: value };
  }

  protected updateSignatures(): void {
    this.signatures = [];
    this.signaturesMissing = [];

    // adiciona departamentos
    this.item.fromDepartments.forEach(department => {
      this.signatures.push({
        check: false,
        position: department.name,
        signedBy: "",
        signedAt: null,
      });
    })

    // Rascunhos ainda não possuem um fluxo de assinaturas em andamento.
    // Mesmo que existam dados antigos associados ao registro, a apresentação
    // deve permanecer neutra até a publicação do memorando.
    if (this.item.status === 'CREATED') return;

    // adiciona assinaturas
    this.item.signatures.forEach(signature => {
      if (!signature.isSign) return;

      const index = this.signatures.findIndex(s => s.position == signature.departmentSigned.name);
      if (index < 0) return;
      this.signatures[index].signedBy += this.signatures[index].signedBy ? '; ' + signature.user.name : signature.user.name;
      if (signature.signedAt && (!this.signatures[index].signedAt || signature.signedAt > this.signatures[index].signedAt!)) {
        this.signatures[index].signedAt = signature.signedAt;
      }
    })

    // verificar assinaturas
    this.item.fromDepartments.forEach(department => {
      let allSignatures = this.item.signatures.filter(s => s.departmentSigned.name == department.name);
      let okSignatures = allSignatures.filter(s => s.isSign)

      if (allSignatures.length > 0 && allSignatures.length == okSignatures.length) {
        this.signatures[this.signatures.findIndex(s => s.position == department.name)].check = true;
        return;
      }

      allSignatures.filter(s => !s.isSign).forEach(missing => {
        if (this.signaturesMissing.findIndex(s => s.id == missing.user.id) == -1) {
          this.signaturesMissing.push(missing.user);
        }
      })
    })

    // verifica se alguém do "signaturesMissing" não é o gestor da área
    this.signaturesMissing.forEach(userMissing => {
      let find = false;

      for (let i=0; i<this.item.fromDepartments.length; i++) {
        for (let j=0; j<this.item.fromDepartments[i].manangers.length; j++) {
          if (this.item.fromDepartments[i].manangers[j].id == userMissing.id) {
            find = true;
            break;
          }
        }

        if (find) break;
      }

      if (!find) {
        let position = this.item.signatures.find(s => s.user.id == userMissing.id)?.departmentSigned;
        this.manangerAlert = { user: userMissing, department: position as Position };
      }
    })
  }

  private verifyCanSign(user: Me): void {
    this.canSign = false;
    if (this.item.status != "PUBLISH") return;

    if (
      this.signaturesMissing.find(u => u.id == user.id)
      && this.manangerAlert?.user.id != user.id
    ) {
      this.canSign = true;
    }
  }

  protected toggleSignModal() {
    this.showSignModal = !this.showSignModal;
  }

  protected handleSignModalChange(event: any) {
    this.showSignModal = event;
  }

  protected onSign(): void {
    this.memorandoService.sign(this.item.id).subscribe({
      next: (data: Memorando) => {
        this.item = data;
        this.websocket.removeByReference(this.item.id);
        this.canSign = false;
        this.updateSignatures();
        this.toasterService.success('Memorando assinado com sucesso!');
        this.toggleSignModal();
        this.cdr.detectChanges();
      },
      error: (error) => this.errorService.showError(error)
    });
  }

  protected togglePublishModal() {
    this.showPublishModal = !this.showPublishModal;
  }

  protected handlePublishModalChange(event: any) {
    this.showPublishModal = event;
  }

  protected onPublish(): void {
    let departmentsId: Array<number> = [];
    this.item.fromDepartments.forEach(department => departmentsId.push(department.id));

    const memorando: NewMemorando = {
      request: this.item.request,
      erpSource: this.item.erpSource,
      client: this.item.client,
      items: this.item.items,
      title: this.item.title,
      description: this.item.description,
      reason: this.item.reason,
      departments: departmentsId,
      status: 'PUBLISH'
    };

    this.memorandoService.update(this.item.id, memorando).subscribe({
      next: (data: Memorando) => {
        this.item = data;
        this.updateSignatures();
        this.verifyCanSign(this.user);
        this.loadNavigation();
        this.toasterService.success('Memorando publicada com sucesso!');
        this.togglePublishModal();
        this.cdr.detectChanges();
      },
      error: (error) => this.errorService.showError(error)
    });
  }

  protected toggleCancelModal() {
    this.showCancelModal = !this.showCancelModal;
  }

  protected handleCancelModalChange(event: any) {
    this.showCancelModal = event;
  }

  protected onCancel(): void {
    this.memorandoService.disable(this.item.id).subscribe({
      next: (data: Memorando) => {
        this.item = data;
        this.updateSignatures();
        this.verifyCanSign(this.user);
        this.toasterService.success('Memorando cancelado com sucesso!');
        this.toggleCancelModal();
        this.cdr.detectChanges();
      },
      error: (error) => this.errorService.showError(error)
    });
  }

  protected toggleRollbackModal() {
    this.showRollbackModal = !this.showRollbackModal;
  }

  protected handleRollbackModalChange(event: any) {
    this.showRollbackModal = event;
  }

  protected onRollback(): void {
    this.memorandoService.rollback(this.item.id).subscribe({
      next: (data: Memorando) => {
        this.item = data;
        this.manangerAlert = null;
        this.updateSignatures();
        this.verifyCanSign(this.user);
        this.loadNavigation();
        this.toasterService.success('Memorando reiniciado com sucesso!');
        this.toggleRollbackModal();
        this.cdr.detectChanges();
      },
      error: (error) => this.errorService.showError(error)
    });
  }

  protected toggleDeleteModal(status = !this.showDeleteModal) {
    this.showDeleteModal = status;
  }

  protected handleDeleteModalChange(event: any) {
    this.showDeleteModal = event;
  }

  protected onDelete(): void {
    this.memorandoService.delete(this.item.id).subscribe({
      next: () => {
        this.toggleDeleteModal(false);
        this.cdr.detectChanges();
        this.toasterService.success('Memorando deletado com sucesso!');
        this.router.navigateByUrl('general/memorando');
      },
      error: (error) => this.errorService.showError(error)
    });
  }

  protected toggleUpdateDepartmentModal(status = !this.showUpdateDepartmentModal) {
    this.showUpdateDepartmentModal = status;
  }

  protected handleUpdateDepartmentModalChange(event: any) {
    this.showUpdateDepartmentModal = event;
  }

  protected onUpdateDepartment(): void {
    let data: UpdateDepartmentMemorando = {
      userId: this.manangerAlert?.user.id as number,
      departmentId: this.manangerAlert?.department.id as number
    }

    this.memorandoService.updateSignatures(this.item.id, data).subscribe({
      next: (data: Memorando) => {
        this.item = data;
        this.manangerAlert = null;
        this.updateSignatures();
        this.verifyCanSign(this.user);
        this.toggleUpdateDepartmentModal(false);
        this.cdr.detectChanges();
        this.toasterService.success('Memorando atualizado com sucesso!');
      },
      error: (error) => this.errorService.showError(error)
    });
  }

  private loadMemorando(id: number): void {
    if (!Number.isFinite(id) || id <= 0) {
      this.router.navigate(['/general/memorando']);
      return;
    }

    this.loading = true;
    this.navigation = { previousId: null, nextId: null };
    this.manangerAlert = null;

    this.memorandoService.findById(id).subscribe({
      next: data => {
        this.item = data;
        this.updateSignatures();
        this.verifyCanSign(this.user);
        this.loadNavigation();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toasterService.error('Registro não encontrado!');
        this.router.navigate(['general/memorando']);
      },
    });
  }

  private loadNavigation(): void {
    this.memorandoService.getNavigation(this.item.id).subscribe({
      next: navigation => {
        this.navigation = navigation;
        this.cdr.detectChanges();
      },
      error: () => {
        this.navigation = { previousId: null, nextId: null };
        this.cdr.detectChanges();
      },
    });
  }
}

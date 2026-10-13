import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonCloseDirective,
  CardBodyComponent,
  CardComponent,
  ContainerComponent,
  FormControlDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  SpinnerComponent
} from '@coreui/angular';
import { FormPasswordDirective } from '@coreui/angular-pro';
import { ModalBackNavigationDirective } from '../../../directive/modal-back-navigation.directive';
import { EmailLog, EmailLogPage } from '../../../interface/email-log.interface';
import { ActiveSession } from '../../../interface/user.interface';
import { EmailLogService } from '../../../services/email-log.service';
import { BunnyService } from '../../../services/bunny.service';
import { ErrorService } from '../../../services/error.service';
import { FoccoService } from '../../../services/focco.service';
import { HomeService } from '../../../services/home.service';
import { RawMaterialsService } from '../../../services/raw-materials.service';
import { RequestMailService } from '../../../services/request-mail.service';
import { ToastrService } from '../../../services/toast.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-params',
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    CardBodyComponent,
    ContainerComponent,
    FormControlDirective,
    FormPasswordDirective,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ButtonCloseDirective,
    SpinnerComponent
  ],
  templateUrl: './params.component.html',
  styleUrl: './params.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ParamsComponent implements OnInit {
  protected rawMaterialHistoryRetention = 1000;
  protected historyRetentionLoading = true;
  protected savingHistoryRetention = false;
  protected activeSessionsVisible = false;
  protected activeSessionsLoading = false;
  protected activeSessions: Array<ActiveSession> = [];
  protected activeSessionsError = '';
  protected disconnectingSessions = new Set<string>();
  protected emailLogsVisible = false;
  protected emailLogsLoading = false;
  protected emailLogsError = '';
  protected emailLogs: Array<EmailLog> = [];
  protected emailLogsPage = 0;
  protected emailLogsTotalPages = 0;
  protected emailLogsTotalElements = 0;
  protected foccoKey = '';
  protected foccoBaseUrl = '';
  protected foccoToken = '';
  protected foccoTokenConfigured = false;
  protected foccoConfigLoading = false;
  protected foccoConfigSaving = false;
  protected bunnyLibraryId = '';
  protected bunnyApiKey = '';
  protected bunnyApiKeyConfigured = false;
  protected bunnyConfigLoading = false;
  protected bunnyConfigSaving = false;
  protected requestMailTo = '';
  protected requestMailConfigLoading = false;
  protected requestMailConfigSaving = false;
  private readonly emailLogsPageSize = 15;

  constructor(
    private userService: UserService,
    private homeService: HomeService,
    private rawMaterialsService: RawMaterialsService,
    private emailLogService: EmailLogService,
    private foccoService: FoccoService,
    private bunnyService: BunnyService,
    private requestMailService: RequestMailService,
    private toasterService: ToastrService,
    private errorService: ErrorService,
    private cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    this.loadFoccoConfig();
    this.loadBunnyConfig();
    this.loadRequestMailConfig();
    this.loadHistoryRetention();
  }

  protected saveFoccoConfig(): void {
    const baseUrl = this.foccoBaseUrl.trim();
    const key = this.foccoKey.trim();
    if (!baseUrl) {
      this.toasterService.error('Informe a URL base do FoccoERP.');
      return;
    }
    if (!key) {
      this.toasterService.error('Informe a Chave do FoccoERP.');
      return;
    }
    if (!this.foccoTokenConfigured && !this.foccoToken.trim()) {
      this.toasterService.error('Informe o token do FoccoERP.');
      return;
    }

    this.foccoConfigSaving = true;
    this.foccoService.updateConfig({ baseUrl, key, token: this.foccoToken }).subscribe({
      next: config => {
        this.foccoBaseUrl = config.baseUrl;
        this.foccoKey = config.key;
        this.foccoToken = '';
        this.foccoTokenConfigured = config.tokenConfigured;
        this.foccoConfigSaving = false;
        this.toasterService.success('Integração com o FoccoERP atualizada.');
        this.cdr.detectChanges();
      },
      error: error => {
        this.foccoConfigSaving = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  protected saveBunnyConfig(): void {
    const libraryId = this.bunnyLibraryId.trim();
    if (!libraryId) {
      this.toasterService.error('Informe o Library ID do Bunny Stream.');
      return;
    }
    if (!this.bunnyApiKeyConfigured && !this.bunnyApiKey.trim()) {
      this.toasterService.error('Informe a API key do Bunny Stream.');
      return;
    }

    this.bunnyConfigSaving = true;
    this.bunnyService.updateConfig({ libraryId, apiKey: this.bunnyApiKey }).subscribe({
      next: config => {
        this.bunnyLibraryId = config.libraryId;
        this.bunnyApiKey = '';
        this.bunnyApiKeyConfigured = config.apiKeyConfigured;
        this.bunnyConfigSaving = false;
        this.toasterService.success('Integração com o Bunny Stream atualizada.');
        this.cdr.detectChanges();
      },
      error: error => {
        this.bunnyConfigSaving = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  protected saveRequestMailConfig(): void {
    const to = this.requestMailTo.trim();
    if (!to) {
      this.toasterService.error('Informe o e-mail destinatário das solicitações de acesso.');
      return;
    }

    this.requestMailConfigSaving = true;
    this.requestMailService.updateConfig({ to }).subscribe({
      next: config => {
        this.requestMailTo = config.to;
        this.requestMailConfigSaving = false;
        this.toasterService.success('Destinatário das solicitações de acesso atualizado.');
        this.cdr.detectChanges();
      },
      error: error => {
        this.requestMailConfigSaving = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  protected clearCache(): void {
    this.homeService.clearAllCache().subscribe({
      next: () => this.toasterService.success('Cache limpo com sucesso!'),
      error: error => this.errorService.showError(error)
    });
  }

  protected saveHistoryRetention(): void {
    const value = Math.trunc(Number(this.rawMaterialHistoryRetention));
    if (!Number.isFinite(value) || value < 10 || value > 100000) {
      this.toasterService.error('Informe um valor entre 10 e 100.000 registros.');
      return;
    }

    this.savingHistoryRetention = true;
    this.rawMaterialsService.updateHistoryRetention(value).subscribe({
      next: setting => {
        this.rawMaterialHistoryRetention = setting.value;
        this.savingHistoryRetention = false;
        this.toasterService.success('Retenção do histórico atualizada.');
        this.cdr.detectChanges();
      },
      error: error => {
        this.savingHistoryRetention = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  protected openActiveSessions(): void {
    this.activeSessionsVisible = true;
    this.activeSessionsLoading = true;
    this.activeSessions = [];
    this.activeSessionsError = '';
    this.userService.getActiveSessions().subscribe({
      next: sessions => {
        this.activeSessions = sessions;
        this.activeSessionsLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.activeSessionsLoading = false;
        this.activeSessionsError = 'Não foi possível carregar as sessões ativas.';
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  protected closeActiveSessions(): void {
    this.activeSessionsVisible = false;
    this.activeSessions = [];
    this.activeSessionsError = '';
  }

  protected onActiveSessionsVisibleChange(visible: boolean): void {
    if (!visible) this.closeActiveSessions();
  }

  protected disconnectSession(session: ActiveSession): void {
    if (this.disconnectingSessions.has(session.sessionId)) return;

    this.disconnectingSessions.add(session.sessionId);
    this.userService.disconnectActiveSession(session.sessionId).subscribe({
      next: () => {
        this.activeSessions = this.activeSessions.filter(item => item.sessionId !== session.sessionId);
        this.disconnectingSessions.delete(session.sessionId);
        this.toasterService.success(`Sessão de ${session.username} desconectada.`);
        this.cdr.detectChanges();
      },
      error: error => {
        this.disconnectingSessions.delete(session.sessionId);
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  protected openEmailLogs(): void {
    this.emailLogsVisible = true;
    this.loadEmailLogs(0);
  }

  protected closeEmailLogs(): void {
    this.emailLogsVisible = false;
    this.emailLogs = [];
    this.emailLogsError = '';
  }

  protected onEmailLogsVisibleChange(visible: boolean): void {
    if (!visible) this.closeEmailLogs();
  }

  protected changeEmailLogsPage(page: number): void {
    if (page < 0 || page >= this.emailLogsTotalPages || page === this.emailLogsPage) return;
    this.loadEmailLogs(page);
  }

  private loadFoccoConfig(): void {
    this.foccoConfigLoading = true;
    this.foccoService.getConfig().subscribe({
      next: config => {
        this.foccoBaseUrl = config.baseUrl;
        this.foccoKey = config.key;
        this.foccoTokenConfigured = config.tokenConfigured;
        this.foccoConfigLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.foccoConfigLoading = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  private loadBunnyConfig(): void {
    this.bunnyConfigLoading = true;
    this.bunnyService.getConfig().subscribe({
      next: config => {
        this.bunnyLibraryId = config.libraryId;
        this.bunnyApiKeyConfigured = config.apiKeyConfigured;
        this.bunnyConfigLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.bunnyConfigLoading = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  private loadRequestMailConfig(): void {
    this.requestMailConfigLoading = true;
    this.requestMailService.getConfig().subscribe({
      next: config => {
        this.requestMailTo = config.to;
        this.requestMailConfigLoading = false;
        if (!this.requestMailTo.trim()) {
          this.toasterService.error('Configure o e-mail destinatário das solicitações de acesso.');
        }
        this.cdr.detectChanges();
      },
      error: error => {
        this.requestMailConfigLoading = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  private loadHistoryRetention(): void {
    this.historyRetentionLoading = true;
    this.rawMaterialsService.getHistoryRetention().subscribe({
      next: setting => {
        this.rawMaterialHistoryRetention = setting.value;
        this.historyRetentionLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.historyRetentionLoading = false;
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }

  private loadEmailLogs(page: number): void {
    this.emailLogsLoading = true;
    this.emailLogsError = '';
    this.emailLogService.list(page, this.emailLogsPageSize).subscribe({
      next: (result: EmailLogPage) => {
        this.emailLogs = result.content;
        this.emailLogsPage = result.number;
        this.emailLogsTotalPages = result.totalPages;
        this.emailLogsTotalElements = result.totalElements;
        this.emailLogsLoading = false;
        this.cdr.detectChanges();
      },
      error: error => {
        this.emailLogsLoading = false;
        this.emailLogsError = 'Não foi possível carregar o histórico de e-mails.';
        this.errorService.showError(error);
        this.cdr.detectChanges();
      }
    });
  }
}

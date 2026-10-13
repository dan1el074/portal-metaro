import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { NgScrollbar } from 'ngx-scrollbar';
import { INavData, ShadowOnScrollDirective, SidebarBrandComponent, SidebarComponent, SidebarFooterComponent, SidebarHeaderComponent, SidebarNavComponent, SidebarService, SidebarToggleDirective, SidebarTogglerDirective} from '@coreui/angular';
import { Me } from '../../interface/user.interface';
import { UserService } from '../../services/user.service';
import { NotificationService } from '../../services/notification.service';
import { NotificationWebSocketService } from '../../services/websocket.service';
import { DefaultFooterComponent, DefaultHeaderComponent } from './';
import { LayoutAlertModalComponent } from './../../../components/modal/layout/layout-alert-modal/layout-alert-modal.component';
import { LayoutSearchModalComponent } from '../../../components/modal/layout/layout-search-modal/layout-search-modal.component';
import { navItems } from './_nav';
import { getNavigationTools } from '../../shared/navigation-tool';
import { ChecklistService } from '../../services/checklist.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss'],
  imports: [
    SidebarComponent,
    SidebarHeaderComponent,
    SidebarBrandComponent,
    SidebarNavComponent,
    SidebarFooterComponent,
    SidebarToggleDirective,
    SidebarTogglerDirective,
    DefaultFooterComponent,
    DefaultHeaderComponent,
    NgScrollbar,
    RouterOutlet,
    ShadowOnScrollDirective,
    LayoutSearchModalComponent,
    LayoutAlertModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DefaultLayoutComponent implements OnInit {
  protected showSearchModal = false;
  protected showAlertModal = false;
  public navItems!: Array<INavData>;

  protected user: Me = {
    id: 0,
    name: '',
    email: '',
    position: null,
    birthDate: '',
    pictureId: null,
    activated: true,
    username: '',
    supportToken: null,
    roles: [],
    pendingIssues: []
  };

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    private wsService: NotificationWebSocketService,
    private sidebarService: SidebarService,
    private checklistService: ChecklistService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  public ngOnInit() {
    this.userService.user$.subscribe(user => {
      if (!user) return;

      this.user = user;
      this.updateTools();
      this.connectWebsocket();
      this.loadChecklistAlerts();
    });

    if (!this.userService.getCurrentUser()) {
      this.userService.refreshUser().subscribe();
    }
  }

  private loadChecklistAlerts(): void {
    const hasChecklistRole = this.user.roles.some(role => ['ROLE_ADMIN', 'ROLE_CHECKLIST_OPERATOR'].includes(role.authority));
    if (!hasChecklistRole) { this.checkFirstAccess(); return; }
    this.checklistService.listStepFlowAlerts().subscribe({
      next: issues => { this.user = { ...this.user, pendingIssues: [...(this.user.pendingIssues ?? []), ...issues] }; this.checkFirstAccess(); },
      error: () => this.checkFirstAccess(),
    });
  }

  private updateTools(): void {
    const customNav: Array<INavData> = [];

    getNavigationTools(this.user.roles).forEach(tool => {
      const toolList: INavData = {
        name: tool.parent,
        url: tool.parentUrl,
        iconComponent: {
          name: tool.parent === 'Administração'
            ? 'cilCursor'
            : tool.parent === 'Sistema'
              ? 'cilEqualizer'
              : 'cilFork'
        },
        children: []
      };

      let index = customNav.findIndex(navItem => navItem.name == tool.parent);

      if (index < 0) {
        customNav.push(toolList);
        index = customNav.length - 1;
      }

      customNav[index].children?.push({
        name: tool.title,
        url: tool.url,
        icon: 'nav-icon-bullet'
      });
    });

    customNav.sort((a, b) => {
      if ((a.name ?? '') === 'Apps' && (b.name ?? '') !== 'Apps') return 1;
      if ((a.name ?? '') !== 'Apps' && (b.name ?? '') === 'Apps') return -1;
      return (a.name ?? '').localeCompare((b.name ?? ''), 'pt-BR', { sensitivity: 'base' });
    });

    customNav.forEach(item => {
      if (item.children?.length == 1) return;

      item.children?.sort((a, b) => {
        return (a.name ?? '').localeCompare((b.name ?? ''), 'pt-BR', { sensitivity: 'base' });
      });
    })

    const tempNavItems = [...navItems];
    tempNavItems.splice(-2, 0, customNav.length > 0 ? { title: true, name: 'Ferramentas' } : {}, ...customNav);

    if (this.user.supportToken && this.user.supportToken != 'null') {
      tempNavItems[tempNavItems.length - 1].url = 'http://suporte.metaro.com.br/autologin.php?token=' + this.user.supportToken;
      tempNavItems[tempNavItems.length - 1].badge = { color: 'info', text: 'LINK' };
    }

    this.navItems = [...tempNavItems];
    this.cdr.detectChanges();
  }

  private connectWebsocket(): void {
    this.notificationService.getMyNotifications().subscribe(list => {
      this.wsService.setInitialNotifications(list);
    });

    this.notificationService.getUnreadCount().subscribe(res => {
      this.wsService.setInitialUnreadCount(res.unreadCount);
    });

    this.wsService.connect();
  }

  private checkFirstAccess(): void {
    if (sessionStorage.getItem('first-access') == 'true') {
      if (!this.user.pendingIssues || this.user.pendingIssues.length == 0) {
        sessionStorage.removeItem('first-access')
        return;
      }

      this.showAlertModal = true;
      this.cdr.detectChanges();
    }
  }

  protected toggleAlertModal(status: boolean): void {
    this.showAlertModal = status;

    if (!status) {
      sessionStorage.removeItem('first-access');
    }

    this.cdr.detectChanges();
  }

  protected toggleSearchModal(status: boolean): void {
    this.showSearchModal = status;
    this.cdr.detectChanges();
  }

  protected goHome(): void {
    if (window.matchMedia('(max-width: 991px)').matches) {
      this.sidebarService.toggle({ id: 'sidebar1', visible: false });
    }
    void this.router.navigate(['/home']);
  }
}

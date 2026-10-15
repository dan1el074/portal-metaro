import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { Container, tsParticles } from '@tsparticles/engine';
import { loadConfettiCannonPreset } from '@tsparticles/preset-confetti-cannon';

let birthdayConfettiPresetLoader: Promise<void> | undefined;

interface BirthdayConfettiStorage {
  user: string;
  shown: 'true' | 'false';
  date: string;
}

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
export class DefaultLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('birthdayConfettiHost') private birthdayConfettiHost?: ElementRef<HTMLDivElement>;
  protected showSearchModal = false;
  protected showAlertModal = false;
  protected showBirthdayConfetti = false;
  public navItems!: Array<INavData>;
  private birthdayConfettiCleanupTimer?: ReturnType<typeof setTimeout>;
  private birthdayConfettiContainer?: Container;
  private birthdayConfettiFrame?: number;
  private birthdayConfettiLaunchTimers: Array<ReturnType<typeof setTimeout>> = [];
  private birthdayConfettiTimer?: ReturnType<typeof setTimeout>;
  private readonly birthdayConfettiStorageKey = 'birthday-confetti';

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

  public ngOnDestroy(): void {
    if (this.birthdayConfettiTimer) clearTimeout(this.birthdayConfettiTimer);
    if (this.birthdayConfettiCleanupTimer) clearTimeout(this.birthdayConfettiCleanupTimer);
    if (this.birthdayConfettiFrame) cancelAnimationFrame(this.birthdayConfettiFrame);
    this.clearBirthdayConfettiLaunchTimers();
    this.birthdayConfettiContainer?.destroy();
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
        this.scheduleBirthdayConfetti();
        return;
      }

      this.showAlertModal = true;
      this.cdr.detectChanges();
    }
  }

  protected toggleAlertModal(status: boolean): void {
    const alertWasVisible = this.showAlertModal;
    this.showAlertModal = status;

    if (!status) {
      sessionStorage.removeItem('first-access');
      if (alertWasVisible) this.scheduleBirthdayConfetti(250);
    }

    this.cdr.detectChanges();
  }

  private scheduleBirthdayConfetti(delay = 0): void {
    if (!this.isDesktopViewport()) return;
    if (!this.shouldShowBirthdayConfetti()) return;

    if (this.birthdayConfettiTimer) clearTimeout(this.birthdayConfettiTimer);

    this.birthdayConfettiTimer = setTimeout(() => {
      if (!this.isDesktopViewport()) return;

      this.showBirthdayConfetti = true;
      this.cdr.detectChanges();
      this.birthdayConfettiFrame = requestAnimationFrame(() => {
        this.birthdayConfettiFrame = undefined;
        void this.startBirthdayConfettiAnimation();
      });
    }, delay);
  }

  private isDesktopViewport(): boolean {
    return window.matchMedia('(min-width: 992px)').matches;
  }

  private shouldShowBirthdayConfetti(): boolean {
    if (!this.router.url.startsWith('/home')) return false;

    const birthDate = this.user.birthDate?.match(/^\d{4}-(\d{2})-(\d{2})/);
    if (!birthDate) return false;

    const today = new Date();
    const isBirthday = Number(birthDate[1]) === today.getMonth() + 1
      && Number(birthDate[2]) === today.getDate();
    if (!isBirthday) {
      this.saveBirthdayConfettiStorage('false');
      return false;
    }

    const stored = this.getBirthdayConfettiStorage();
    const todayValue = this.getBirthdayConfettiDate(today);
    return stored?.user !== this.user.username
      || stored.shown !== 'true'
      || stored.date !== todayValue;
  }

  private getBirthdayConfettiStorage(): BirthdayConfettiStorage | null {
    const stored = localStorage.getItem(this.birthdayConfettiStorageKey);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as BirthdayConfettiStorage;
    } catch {
      return null;
    }
  }

  private saveBirthdayConfettiStorage(shown: 'true' | 'false'): void {
    const value: BirthdayConfettiStorage = {
      user: this.user.username,
      shown,
      date: this.getBirthdayConfettiDate(new Date()),
    };
    localStorage.setItem(this.birthdayConfettiStorageKey, JSON.stringify(value));
  }

  private getBirthdayConfettiDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
  }

  private async startBirthdayConfettiAnimation(): Promise<void> {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.saveBirthdayConfettiStorage('false');
      this.finishBirthdayConfettiAnimation();
      return;
    }

    const host = this.birthdayConfettiHost?.nativeElement;
    if (!host) {
      this.saveBirthdayConfettiStorage('false');
      this.finishBirthdayConfettiAnimation();
      return;
    }

    let container: Container | undefined;
    try {
      birthdayConfettiPresetLoader ??= loadConfettiCannonPreset(tsParticles);
      await birthdayConfettiPresetLoader;
      container = await tsParticles.load({
        id: 'birthday-confetti',
        element: host,
        options: {
          preset: 'confettiCannon',
          fullScreen: { enable: false },
          interactivity: { events: { onClick: { enable: false } } },
        },
      });
    } catch {
      this.saveBirthdayConfettiStorage('false');
      this.finishBirthdayConfettiAnimation();
      return;
    }

    if (!container) {
      this.saveBirthdayConfettiStorage('false');
      this.finishBirthdayConfettiAnimation();
      return;
    }

    this.birthdayConfettiContainer = container;
    try {
      this.fireBirthdayConfettiCannon(container);
      this.saveBirthdayConfettiStorage('true');
    } catch {
      this.saveBirthdayConfettiStorage('false');
      this.finishBirthdayConfettiAnimation();
      return;
    }
    this.birthdayConfettiCleanupTimer = setTimeout(() => this.finishBirthdayConfettiAnimation(), 6000);
  }

  private finishBirthdayConfettiAnimation(): void {
    if (this.birthdayConfettiCleanupTimer) clearTimeout(this.birthdayConfettiCleanupTimer);
    if (this.birthdayConfettiFrame) cancelAnimationFrame(this.birthdayConfettiFrame);
    this.clearBirthdayConfettiLaunchTimers();
    this.birthdayConfettiContainer?.destroy();
    this.birthdayConfettiCleanupTimer = undefined;
    this.birthdayConfettiFrame = undefined;
    this.birthdayConfettiContainer = undefined;
    this.showBirthdayConfetti = false;
    this.cdr.detectChanges();
  }

  private fireBirthdayConfettiCannon(container: Container): void {
    const pixelRatio = container.retina.pixelRatio;
    const viewportWidth = container.canvas.size.width / pixelRatio;
    const viewportHeight = container.canvas.size.height / pixelRatio;
    const isDesktop = viewportWidth >= 992;
    const launchSpeed = Math.min(64, Math.max(35, viewportHeight / (isDesktop ? 18 : 20)));
    const count = isDesktop ? 190 : Math.min(150, Math.max(100, Math.round(viewportHeight * .16)));
    const maxAngleOffset = isDesktop ? 44 : 32;
    const waveCount = isDesktop ? 7 : 6;
    const origin = {
      x: container.canvas.size.width / 2,
      y: container.canvas.size.height - 6 * pixelRatio,
    };

    const launchWave = (wave: number): void => {
      if (container.destroyed) return;

      const particlesInWave = Math.floor(count / waveCount) + (wave < count % waveCount ? 1 : 0);
      for (let index = 0; index < particlesInWave; index++) {
        const angleOffset = -maxAngleOffset + Math.random() * maxAngleOffset * 2;
        const direction = -90 + angleOffset;
        const verticalCompensation = Math.max(.7, Math.cos(angleOffset * Math.PI / 180));
        const speed = launchSpeed * (.86 + Math.random() * .28) / verticalCompensation;
        container.particles.addParticle(origin, {
          move: {
            enable: true,
            decay: .008,
            direction,
            speed,
            straight: true,
          },
          size: { value: isDesktop ? { min: 5, max: 9 } : { min: 3, max: 5 } },
        });
      }
    };

    launchWave(0);
    for (let wave = 1; wave < waveCount; wave++) {
      this.birthdayConfettiLaunchTimers.push(setTimeout(() => launchWave(wave), wave * 45));
    }
  }

  private clearBirthdayConfettiLaunchTimers(): void {
    this.birthdayConfettiLaunchTimers.forEach(timer => clearTimeout(timer));
    this.birthdayConfettiLaunchTimers = [];
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

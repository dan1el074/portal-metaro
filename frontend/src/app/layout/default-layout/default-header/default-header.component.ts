import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, input, OnInit, Output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { AvatarComponent, BadgeComponent, BreadcrumbComponent, BreadcrumbItemComponent, BreadcrumbRouterComponent, ColorModeService, ContainerComponent, DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective, HeaderComponent, HeaderNavComponent, HeaderTogglerDirective, IBreadcrumbItem, SidebarToggleDirective } from '@coreui/angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { cilBell, cilMenu, cilTask, cilSettings, cilAccountLogout, cilX, cilSun, cilMoon, cilContrast, cilPaperclip, cilCommentBubble, cilTrash } from '@coreui/icons';
import { IconDirective } from '@coreui/icons-angular';
import { Me } from '../../../interface/user.interface';
import { TimeAgoPipe } from './../../../pipes/time-ago.pipe';
import { NotificationWebSocketService } from './../../../services/websocket.service';
import { NotificationService } from './../../../services/notification.service';
import { Notification } from '../../../interface/notification.interface';
import { environment } from '../../../../environments/environment';
import { LayoutButtonSearchComponent } from './layout-button-search/layout-button-search.component';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  imports: [
    ContainerComponent,
    HeaderTogglerDirective,
    SidebarToggleDirective,
    IconDirective,
    HeaderNavComponent,
    RouterLink,
    NgTemplateOutlet,
    BreadcrumbComponent,
    BreadcrumbItemComponent,
    BreadcrumbRouterComponent,
    DropdownComponent,
    DropdownToggleDirective,
    AvatarComponent,
    DropdownMenuDirective,
    DropdownItemDirective,
    BadgeComponent,
    TimeAgoPipe,
    LayoutButtonSearchComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit {
  @Input()
  public user!: Me;
  @Output()
  protected openModal = new EventEmitter<any>();
  protected apiUrl = environment.apiUrl;
  readonly icons = { cilBell, cilMenu, cilTask, cilSettings, cilAccountLogout, cilX, cilPaperclip, cilCommentBubble, cilTrash };
  readonly sidebarId = input('sidebar1');
  protected readonly checklistBreadcrumbs = signal<IBreadcrumbItem[] | null>(null);
  readonly #colorModeService = inject(ColorModeService);
  readonly colorMode = this.#colorModeService.colorMode;
  readonly colorModes = [
    { name: 'light', text: 'Claro', icon: cilSun },
    { name: 'dark', text: 'Escuro', icon: cilMoon },
    { name: 'auto', text: 'Automático', icon: cilContrast }
  ];

  constructor(
    protected websocket: NotificationWebSocketService,
    protected notificationService: NotificationService,
    protected router: Router
  ) {
    super();
    this.updateChecklistBreadcrumbs(this.router.url);
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe((event) => this.updateChecklistBreadcrumbs(event.urlAfterRedirects));
  }

  public ngOnInit(): void {
    let theme = this.colorModes.find(mode => localStorage.getItem('theme')?.includes(mode.name))?.name ?? 'light';
    this.colorMode.set(theme);

    if (theme == 'auto') theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    document.documentElement.setAttribute('data-coreui-theme', theme);
  }

  public getIcon(): Array<string> {
    const currentMode = this.colorMode();
    return this.colorModes.find(mode => mode.name === currentMode)?.icon ?? cilSun;
  }

  public openNotification(notification: Notification) {
    if (notification.actionUrl) this.router.navigateByUrl(notification.actionUrl);

    if (notification.autoDelete) {
      this.notificationService.delete(notification.id).subscribe(() => {
        this.websocket.removeLocal(notification.id);
      });
      return;
    }

    if (!notification.viewed) {
      this.notificationService.markAsViewed(notification.id).subscribe(() => {
        this.websocket.markAsViewedLocal(notification.id);
      });
    }
  }

  public openProjectSearchModal(): void {
    this.openModal.emit();
  }

  public markAllAsViewed(): void {
    this.notificationService.markAllAsViewed().subscribe();
  }

  private updateChecklistBreadcrumbs(rawUrl: string): void {
    const url = rawUrl.split(/[?#]/, 1)[0].replace(/\/$/, '');
    const memorandoRoot = '/general/memorando';
    if (url === memorandoRoot || url.startsWith(`${memorandoRoot}/`)) {
      const segments = url.slice(memorandoRoot.length).split('/').filter(Boolean);
      const items: IBreadcrumbItem[] = [
        { label: 'Home', url: '/' },
        { label: 'Geral' },
        { label: 'Memorando', url: memorandoRoot },
      ];
      if (segments[0]) items.push({ label: 'Visualização', url: `${memorandoRoot}/${segments[0]}` });
      if (segments[1] === 'edit') items.push({ label: 'Edição' });
      this.checklistBreadcrumbs.set(items);
      return;
    }

    const root = '/qualidade/checklist';
    if (url !== root && !url.startsWith(`${root}/`)) {
      this.checklistBreadcrumbs.set(null);
      return;
    }

    const items: IBreadcrumbItem[] = [
      { label: 'Home', url: '/' },
      { label: 'Checklist', url: root },
    ];
    const segments = url.slice(root.length).split('/').filter(Boolean);

    if (segments[0] === 'models') {
      items.push({ label: 'Modelos', url: `${root}/models` });
      if (segments[1] === 'new') items.push({ label: 'Novo modelo' });
      else if (segments[1]) items.push({ label: 'Editar modelo' });
    } else if (segments[0] === 'new') {
      items.push({ label: 'Novo checklist' });
    } else if (segments[0]) {
      items.push({ label: 'Inspeção', url: `${root}/${segments[0]}` });
      if (segments[1] === 'edit') items.push({ label: 'Editar checklist' });
    }

    this.checklistBreadcrumbs.set(items);
  }
}

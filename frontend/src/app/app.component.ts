import { Component, DestroyRef, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { delay, filter, map, tap } from 'rxjs/operators';
import { ColorModeService } from '@coreui/angular';
import { IconSetService } from '@coreui/icons-angular';
import { cilHome, cilChartPie, cilNewspaper, cilCalendar, cilSettings, cilCursor, cilFork, cilEqualizer, cilCommentBubble, cibFacebook, cibTwitter, cibLinkedin, cibGoogle, cilUserFemale, cilUser } from '@coreui/icons';
import { NgxSpinnerModule } from 'ngx-spinner';

@Component({
    selector: 'app-root',
    template: '<ngx-spinner name="loginSpinner" bdColor="#ebebeb" size="default" color="#0053b0" type="ball-clip-rotate" [fullScreen]="true"></ngx-spinner><router-outlet />',
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [RouterOutlet, NgxSpinnerModule]
})
export class AppComponent implements OnInit {
  title = 'Portal Metaro';

  readonly #destroyRef: DestroyRef = inject(DestroyRef);
  readonly #activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #titleService = inject(Title);
  readonly #colorModeService = inject(ColorModeService);
  readonly #iconSetService = inject(IconSetService);

  constructor() {
    // Remove o JWT deixado por versoes anteriores da aplicacao.
    localStorage.removeItem('auth-token');
    this.#titleService.setTitle(this.title);
    this.#iconSetService.icons = { cilHome, cilChartPie, cilNewspaper, cilCalendar, cilSettings, cilCursor, cilFork, cilEqualizer, cilCommentBubble, cibFacebook, cibTwitter, cibLinkedin, cibGoogle, cilUserFemale, cilUser };
    this.#colorModeService.localStorageItemName.set('theme');
    this.#colorModeService.eventName.set('ColorSchemeChange');
  }

  ngOnInit(): void {
    this.#router.events.pipe(takeUntilDestroyed(this.#destroyRef)).subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
    });

    this.#activatedRoute.queryParams.pipe(
        delay(1),
        map(params => <string>params['theme']?.match(/^[A-Za-z0-9\s]+/)?.[0]),
        filter(theme => ['dark', 'light', 'auto'].includes(theme)),
        tap(theme => {
          this.#colorModeService.colorMode.set(theme);
        }),
        takeUntilDestroyed(this.#destroyRef)
    ).subscribe();
  }
}

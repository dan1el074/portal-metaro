import { ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation, withRouterConfig } from '@angular/router';
import { routes } from './app.routes';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { authInterceptor } from './interceptor/auth.interceptor';
import { rateLimitInterceptor } from './interceptor/rate-limit.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
      withRouterConfig({ onSameUrlNavigation: 'reload' }),
      withHashLocation()
    ),
    provideAnimations(),
    provideHttpClient(withXhr(),
      withInterceptors([authInterceptor, rateLimitInterceptor])
    )
  ]
};

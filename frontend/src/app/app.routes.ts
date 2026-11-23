import { Routes } from '@angular/router';
import { AuthGuard } from './config/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: '',
    loadComponent: () => import('./layout/default-layout').then((m) => m.DefaultLayoutComponent), data: { title: 'Home' },
    children: [
      {
        path: 'qualidade',
        loadChildren: () => import('./views/quality/routes').then((m) => m.routes),
      },
      {
        path: 'home',
        loadChildren: () => import('./views/home/routes').then((m) => m.routes),
        canActivate: [AuthGuard]
      },
      {
        path: 'config',
        loadChildren: () => import('./views/config/routes').then((m) => m.routes),
        canActivate: [AuthGuard]
      },
      {
        path: 'administration',
        loadChildren: () => import('./views/administration/routes').then((m) => m.routes),
      },
      {
        path: 'general',
        loadChildren: () => import('./views/general/routes').then((m) => m.routes),
      },
      {
        path: 'engineering',
        loadChildren: () => import('./views/engineering/routes').then((m) => m.routes),
      },
      {
        path: 'pcp',
        loadChildren: () => import('./views/pcp/routes').then((m) => m.routes),
      },
      {
        path: 'system',
        loadChildren: () => import('./views/system/routes').then((m) => m.routes),
      }
    ],
  },
  {
    path: '404',
    loadComponent: () => import('./views/errors/page404/page404.component')
      .then((m) => m.Page404Component), data: { title: 'Page 404' },
  },
  {
    path: '500',
    loadComponent: () => import('./views/errors/page500/page500.component')
      .then((m) => m.Page500Component), data: { title: 'Page 500' },
  },
  {
    path: 'login',
    loadComponent: () => import('./views/login/login.component')
      .then((m) => m.LoginComponent), data: { title: 'Login Page' },
  },
  {
    path: '**',
    redirectTo: '404'
  },
];

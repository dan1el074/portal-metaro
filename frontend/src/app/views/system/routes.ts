import { Routes } from '@angular/router';
import { AuthGuard } from '../../config/auth.guard';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Sistema'
    },
    children: [
      {
        path: '',
        redirectTo: '/',
        pathMatch: 'full'
      },
      {
        path: 'params',
        loadComponent: () => import('./params/params.component').then(m => m.ParamsComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN', 'ROLE_SYSTEM_PARAMS'],
          title: 'Parâmetros'
        }
      }
    ]
  }
];

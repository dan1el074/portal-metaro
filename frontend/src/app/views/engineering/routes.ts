import { Routes } from '@angular/router';
import { AuthGuard } from '../../config/auth.guard';

export const routes: Routes = [
  {
    path: '',
    data: { title: 'Engenharia' },
    children: [
      { path: '', redirectTo: '/', pathMatch: 'full' },
      {
        path: 'trello-integration',
        loadComponent: () => import('./trello-integration/trello-integration.component').then(m => m.TrelloIntegrationComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN', 'ROLE_TRELLO_INTEGRATION', 'ROLE_TRELLO_INTEGRATION_ADMIN'],
          title: 'Integração Trello',
        },
      },
    ],
  },
];

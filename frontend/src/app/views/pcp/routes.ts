import { Routes } from '@angular/router';
import { AuthGuard } from '../../config/authGuard';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'PCP'
    },
    children: [
      {
        path: '',
        redirectTo: '/',
        pathMatch: 'full'
      },
      {
        path: 'kanban-exclusion',
        loadComponent: () => import('./kanban-exclusion/kanban-exclusion.component')
          .then(component => component.KanbanExclusionComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN', 'ROLE_KANBAN_EXCLUSION'],
          title: 'Exclusão de Kanban'
        }
      }
    ]
  }
];

import { Routes } from '@angular/router';
import { AuthGuard } from '../../config/auth.guard';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'PCP'
    },
    children: [
      {
        path: 'serial-plates',
        loadComponent: () => import('./serial-plates/serial-plates.component').then(m => m.SerialPlatesComponent),
        canActivate: [AuthGuard],
        data: {
          title: 'Nº Série/Plaquetas',
          roles: ['ROLE_ADMIN', 'ROLE_SERIAL_PLATES_OPERATOR', 'ROLE_SERIAL_PLATES_CONSULTATION']
        }
      },
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

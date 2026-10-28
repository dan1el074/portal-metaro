import { Routes } from '@angular/router';
import { AuthGuard } from '../../config/auth.guard';

export const routes: Routes = [
  {
    path: '',
    data: {
      title: 'Geral'
    },
    children: [
      {
        path: '',
        redirectTo: '/',
        pathMatch: 'full'
      },
      {
        path: 'memorando',
        loadComponent: () => import('./memorando/memorando.component').then(m => m.MemorandoComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN','ROLE_MEMORANDO'],
          title: 'Memorando'
        }
      },
      {
        path: 'memorando/:id',
        loadComponent: () => import('./memorando/document-view/document-view.component').then(m => m.DocumentViewComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN','ROLE_MEMORANDO'],
          title: 'Memorando'
        }
      },
      {
        path: 'memorando/:id/edit',
        loadComponent: () => import('./memorando/document-view/edit-memorando/edit-memorando.component').then(m => m.EditMemorandoComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN','ROLE_MEMORANDO'],
          title: 'Memorando'
        }
      },
      {
        path: 'raw-materials',
        loadComponent: () => import('./raw-materials/raw-materials.component').then(m => m.RawMaterialsComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN','ROLE_RAW_MATERIALS'],
          title: 'Matérias primas'
        }
      },
      {
        path: 'step-flow',
        loadComponent: () => import('./step-flow/step-flow.component').then(m => m.StepFlowComponent),
        canActivate: [AuthGuard],
        data: {
          roles: ['ROLE_ADMIN','ROLE_STEP_FLOW'],
          title: 'Fluxo de etapas'
        }
      }
    ]
  }
];

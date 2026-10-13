import { Routes } from '@angular/router';
import { AuthGuard } from '../../config/authGuard';
import { checklistLeaveGuard } from '../../config/checklist-leave.guard';

const checklistRoles = [
  'ROLE_ADMIN',
  'ROLE_CHECKLIST',
  'ROLE_CHECKLIST_ADMIN',
  'ROLE_CHECKLIST_OPERATOR',
  'ROLE_CHECKLIST_CONSULTATION',
];

export const routes: Routes = [
  {
    path: 'checklist',
    canActivate: [AuthGuard],
    data: { title: 'Checklist', roles: checklistRoles },
    children: [
      { path: '', loadComponent: () => import('./checklist/checklist.component').then((m) => m.ChecklistComponent,) },
      {
        path: 'models',
        data: { title: 'Modelos' },
        loadComponent: () => import('./checklist/models/checklist-models.component').then((m) => m.ChecklistModelsComponent)
      },
      {
        path: 'models/new',
        data: { title: 'Novo modelo' },
        canDeactivate: [checklistLeaveGuard],
        loadComponent: () => import('./checklist/models/new/checklist-model-new.component').then((m) => m.ChecklistModelNewComponent)
      },
      {
        path: 'models/:id',
        data: { title: 'Editar modelo' },
        canDeactivate: [checklistLeaveGuard],
        loadComponent: () => import('./checklist/models/edit/checklist-model-edit.component').then((m) => m.ChecklistModelEditComponent)
      },
      {
        path: 'new/:id',
        data: { title: 'Novo checklist' },
        canDeactivate: [checklistLeaveGuard],
        loadComponent: () => import('./checklist/records/new/checklist-record-new.component').then((m) => m.ChecklistRecordNewComponent)
      },
      {
        path: ':id/edit',
        data: { title: 'Editar checklist' },
        canDeactivate: [checklistLeaveGuard],
        loadComponent: () => import('./checklist/records/edit/checklist-record-edit.component').then((m) => m.ChecklistRecordEditComponent)
      },
      {
        path: ':id',
        data: { title: 'Inspeção' },
        loadComponent: () => import('./checklist/records/detail/checklist-record-detail.component').then((m) => m.ChecklistRecordDetailComponent)
      }
    ]
  }
];

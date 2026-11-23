import { CanDeactivateFn } from '@angular/router';

export interface ChecklistPendingChanges {
  canDeactivate(): boolean | Promise<boolean>;
}

export const checklistLeaveGuard: CanDeactivateFn<ChecklistPendingChanges> = component => component.canDeactivate();

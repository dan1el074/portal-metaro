import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

export type ChecklistIconName =
  | 'archive'
  | 'arrow-left'
  | 'ban'
  | 'chevron-down'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'circle-check'
  | 'clipboard-list'
  | 'clock'
  | 'copy'
  | 'eye'
  | 'file-text'
  | 'filter-x'
  | 'folder-cog'
  | 'history'
  | 'message-square'
  | 'package'
  | 'pencil'
  | 'plus'
  | 'printer'
  | 'save'
  | 'settings'
  | 'shield-check'
  | 'trash'
  | 'user-cog'
  | 'users'
  | 'x';

@Component({
  selector: 'app-checklist-icon',
  imports: [],
  templateUrl: './checklist-icon.component.html',
  styleUrl: './checklist-icon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistIconComponent {
  @Input({ required: true }) name!: ChecklistIconName;
}

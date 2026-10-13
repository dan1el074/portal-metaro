import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProgressComponent, ProgressBarComponent } from '@coreui/angular';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';

@Component({
  selector: 'app-checklist-upload-modal',
  imports: [ProgressComponent, ProgressBarComponent],
  templateUrl: './checklist-upload-modal.component.html',
  styleUrl: './checklist-upload-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistUploadModalComponent {
  protected readonly store = inject(ChecklistPreviewService);
}

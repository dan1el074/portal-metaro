import { Component, Input } from '@angular/core';
import { ReportPreviewData } from '../../app/interface/report-preview.interface';

@Component({
  selector: 'app-report-preview',
  templateUrl: './report-preview.component.html',
  styleUrl: './report-preview.component.scss'
})
export class ReportPreviewComponent {
  @Input() public report!: ReportPreviewData;
  @Input() public warnings: readonly string[] = [];
  @Input() public warningTitle = 'Complete os dados antes de emitir o relatório:';
}

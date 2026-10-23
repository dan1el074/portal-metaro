import { Injectable } from '@angular/core';
import { ReportPreviewData } from '../interface/report-preview.interface';
import { ReportPreviewDocument } from '../../components/report-preview/report-preview-document';

@Injectable({ providedIn: 'root' })
export class ReportPreviewService {
  public open(data: ReportPreviewData, targetWindow?: Window): boolean {
    const previewWindow = targetWindow ?? window.open('', '_blank');

    if (!previewWindow) return false;

    previewWindow.document.write(ReportPreviewDocument.render(data));
    previewWindow.document.close();

    return true;
  }
}

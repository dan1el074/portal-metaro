import { Injectable } from '@angular/core';
import { ReportPreviewData } from '../interface/report-preview.interface';
import { ReportPreviewDocument } from '../../components/report-preview/report-preview-document';

@Injectable({ providedIn: 'root' })
export class ReportPreviewService {
  public open(data: ReportPreviewData, targetWindow?: Window): boolean {
    return this.openDocument(ReportPreviewDocument.render(data), targetWindow);
  }

  private openDocument(html: string, targetWindow?: Window): boolean {
    const previewWindow = targetWindow ?? window.open('', '_blank');

    if (!previewWindow) return false;

    try {
      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();
    } catch (error) {
      previewWindow.close();
      throw error;
    }

    return true;
  }

  public openElement(element: HTMLElement, title: string, targetWindow?: Window): boolean {
    const content = element.cloneNode(true) as HTMLElement;
    content.classList.add('print-preview-mode');
    content.querySelectorAll('.no-print').forEach(node => node.remove());
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(node => node.outerHTML).join('');
    const escape = (value: string) => value.replace(/[&<>"']/g, char =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
    const html = `<!doctype html><html lang="pt-BR" data-coreui-theme="light"><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <base href="${escape(document.baseURI)}"><title>${escape(title)}</title>${styles}
      <style>
        html { color-scheme: light; }
        body { margin: 0; padding: 24px 16px 40px; background: #e9edf2; color: #252a36; font: 12px/1.5 Arial, sans-serif; }
        .checklist-preview-sheet { box-sizing: border-box; width: 210mm; max-width: 100%; min-height: 297mm; margin: 0 auto; padding: 10mm; border: 1px solid #dce2ea; background: #fff; box-shadow: 0 8px 30px rgba(38, 52, 73, .09); }
        .checklist-preview-toolbar { width: 210mm; max-width: 100%; margin: 0 auto 16px; display: flex; justify-content: flex-end; }
        .checklist-preview-toolbar button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border: 0; border-radius: 8px; background: #285ea5; color: #fff; font: 600 13px Arial, sans-serif; cursor: pointer; box-shadow: 0 2px 6px #1d355724; }
        .checklist-preview-toolbar button:hover { background: #214e8b; }
        .checklist-preview-toolbar button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        body.printing-quality-checklist .print-preview-mode { display: block; width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
        .print-preview-mode .checklist-print-area { width: 210mm; max-width: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; }
        .print-preview-mode .document-card { margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
        .print-preview-mode .print-only { display: block !important; }
        .print-preview-mode .video-qr { display: grid !important; }
        .print-preview-mode, .print-preview-mode * { box-sizing: border-box; }
        .print-preview-mode { font: 12px/1.5 Arial, sans-serif !important; }
        .print-preview-mode .detail-content { min-width: 0 !important; margin: 0 !important; padding: 0 !important; gap: 0 !important; }
        .print-preview-mode .document-header { grid-template-columns: minmax(0, .9fr) minmax(0, 1.8fr) minmax(0, .9fr) !important; grid-template-areas: none !important; }
        .print-preview-mode .quality-brand, .print-preview-mode .document-identification, .print-preview-mode .quality-reference { grid-area: auto !important; padding: 12px 10px !important; }
        .print-preview-mode .quality-brand .brand-logo { width: 130px !important; }
        .print-preview-mode .document-header h1 { font-size: 20px !important; }
        .print-preview-mode .quality-brand span, .print-preview-mode .quality-reference span,
        .print-preview-mode .document-identification > span, .print-preview-mode .metadata-grid strong,
        .print-preview-mode .additional-metadata-grid strong, .print-preview-mode .document-label { font-size: 11px !important; letter-spacing: normal !important; }
        body.printing-quality-checklist .print-preview-mode .metadata-grid { display: flex !important; flex-wrap: nowrap !important; justify-content: space-between !important; gap: 10px 16px !important; padding: 12px 10px !important; }
        body.printing-quality-checklist .print-preview-mode .metadata-grid > div { min-width: 0 !important; max-width: 100% !important; flex: 0 1 auto !important; }
        body.printing-quality-checklist .print-preview-mode .metadata-grid > .metadata-order,
        body.printing-quality-checklist .print-preview-mode .metadata-grid > .metadata-serial { flex: 0 0 auto !important; }
        body.printing-quality-checklist .print-preview-mode .metadata-grid > .metadata-serial { order: -1; }
        body.printing-quality-checklist .print-preview-mode .metadata-grid > .metadata-client,
        body.printing-quality-checklist .print-preview-mode .metadata-grid > .metadata-item { min-width: 0 !important; flex: 1 1 auto !important; }
        body.printing-quality-checklist .print-preview-mode .metadata-grid strong { display: block !important; white-space: normal !important; overflow: visible !important; text-overflow: clip !important; overflow-wrap: anywhere; }
        .print-preview-mode .additional-metadata-grid { padding: 12px 10px !important; gap: 10px 16px !important; }
        .print-preview-mode .document-section { min-width: 0 !important; padding: 14px 0 !important; gap: 16px !important; border-bottom: 0 !important; }
        .print-preview-mode .detail-table-container { min-width: 0 !important; width: 100% !important; overflow: visible !important; }
        .print-preview-mode .detail-table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; font-size: 10px !important; }
        .print-preview-mode .detail-table th, .print-preview-mode .detail-table td { padding: 9px 6px !important; font-size: 10px !important; line-height: 1.5 !important; white-space: normal !important; overflow-wrap: anywhere !important; vertical-align: top; }
        .print-preview-mode .detail-table thead th { white-space: nowrap !important; overflow-wrap: normal !important; }
        .print-preview-mode .detail-table .number-column, .print-preview-mode .detail-table .number { width: 30px !important; color: #697586 !important; }
        .print-preview-mode .detail-table .mark-column, .print-preview-mode .detail-table .mark { width: 30px !important; }
        .print-preview-mode .detail-table .item-description-column, .print-preview-mode .detail-table .item-description { width: 32% !important; }
        .print-preview-mode .mobile-question-number { display: none !important; }
        .print-preview-mode .answer-checkbox { width: 14px !important; height: 14px !important; border-width: 1px !important; border-radius: 3px !important; }
        .print-preview-mode .answer-checkbox svg { width: 10px !important; height: 10px !important; }
        .print-preview-mode .question-additional-fields, .print-preview-mode .nok-description { gap: 2px !important; }
        .print-preview-mode .question-additional-fields span, .print-preview-mode .question-additional-fields strong,
        .print-preview-mode .nok-description strong, .print-preview-mode .nok-description span { font-size: 10px !important; }
        .print-preview-mode .section-card-header { padding: 12px 10px !important; }
        .print-preview-mode .section-card-header h2 { font-size: 12px !important; }
        .print-preview-mode .section-card-header p, .print-preview-mode .problem-copy strong,
        .print-preview-mode .problem-copy p, .print-preview-mode .problem-copy small,
        .print-preview-mode .problem-number, .print-preview-mode .problem-status,
        .print-preview-mode figcaption, .print-preview-mode .print-history { font-size: 10px !important; }
        body.printing-quality-checklist .print-preview-mode .checklist-footer-section { margin: 16px 0 0 !important; padding: 0 !important; border: 1px solid #dce2ea !important; border-radius: 6px !important; box-shadow: none !important; background: #fff !important; color: #252a36; page-break-inside: avoid; break-inside: avoid-page; }
        body.printing-quality-checklist .print-preview-mode .checklist-footer-section > .checklist-footer-header { display: flex; margin: 0 !important; padding: 12px !important; border: 0 !important; border-bottom: 1px solid #dce2ea !important; border-radius: 5px 5px 0 0; background: #f5f7fa; break-inside: avoid; break-after: avoid; }
        body.printing-quality-checklist .print-preview-mode .checklist-footer-section > .card-content { padding: 12px !important; }
        .print-preview-mode .checklist-footer-header > div { display: flex; flex-direction: column; gap: 3px; }
        body.printing-quality-checklist .print-preview-mode .checklist-footer-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; color: #252a36; font-size: 12px !important; font-weight: 700; line-height: 1.5; letter-spacing: normal !important; text-transform: none !important; }
        body.printing-quality-checklist .print-preview-mode .checklist-footer-header h2 app-checklist-icon { display: inline-flex !important; flex: 0 0 14px; font-size: 14px !important; color: #697586; }
        .print-preview-mode .checklist-footer-header p { margin: 0 !important; font-size: 10px !important; line-height: 1.5; color: #697586; }
        .print-preview-mode .print-history ol { margin: 0 !important; padding: 12px 12px 12px 18px !important; list-style: none; }
        .print-preview-mode .print-history li { position: relative; margin: 0; padding: 0 0 14px 18px !important; border-left: 1px solid #d8dbe0; border-bottom: 0 !important; break-inside: avoid; }
        .print-preview-mode .print-history li::before { content: ''; position: absolute; left: -4px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background: #285ea5; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .print-preview-mode .print-history li:last-child { padding-bottom: 0 !important; }
        .print-preview-mode .print-history li > span { display: block; color: #697586; font-size: 9px; }
        .print-preview-mode .print-history li p { margin: 3px 0 0; font-size: 10px; line-height: 1.5; overflow-wrap: anywhere; }
        .print-preview-mode .print-history li p strong { font-weight: 700; }
        .print-preview-mode .evidence-gallery { overflow: visible !important; flex-wrap: wrap !important; gap: 16px !important; }
        .print-preview-mode .evidence-item { width: 46mm !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; break-inside: avoid; }
        .print-preview-mode .evidence-item figcaption { margin: 6px 0 0; padding: 0 !important; border: 0 !important; background: transparent !important; color: #697586; text-align: center; white-space: normal !important; overflow-wrap: anywhere; line-height: 1.4; }
        .print-preview-mode .video-qr { padding: 0 !important; }
        .print-preview-mode .print-image { height: 26mm !important; object-fit: contain !important; }
        .print-preview-mode .video-qr img, .print-preview-mode .qr-placeholder { width: 24mm !important; height: 24mm !important; }
        .print-preview-mode .signature { margin: 20px auto !important; }
        .print-preview-mode .signature small { font-size: 10px !important; }
        .print-preview-mode .signature span { font-size: 20px !important; }
        @page checklist-document { size: A4 portrait; margin: 10mm; }
        @media print { body { padding: 0; background: white; } .checklist-preview-toolbar { display: none !important; } .checklist-preview-sheet { width: auto; max-width: none; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; } }
      </style></head><body class="printing-quality-checklist">
      <div class="checklist-preview-toolbar no-print"><button type="button" onclick="window.print()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v8H6z"></path></svg>Imprimir</button></div>
      <main class="checklist-preview-sheet">${content.outerHTML}</main></body></html>`;
    return this.openDocument(html, targetWindow);
  }
}

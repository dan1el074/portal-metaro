import type { ReportPreviewData } from '../../app/interface/report-preview.interface';

export class ReportPreviewDocument {
  public static fileName(prefix: string, date: Date, timeZone = 'America/Sao_Paulo' ): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((value) => value.type === type)!.value;

    return `${prefix}-${part('year')}${part('month')}${part('day')}-${part('hour')}${part('minute')}${part('second')}`;
  }

  private static escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
  }

  public static render(data: ReportPreviewData, issuedAt = new Date()): string {
    const rows = data.rows.map((values) => `<tr>${values.map((value) => `<td>${this.escapeHtml(value)}</td>`).join('')}</tr>`).join('');

    return `
      <!doctype html>
      <html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${this.escapeHtml(this.fileName(data.fileNamePrefix, issuedAt, data.timeZone))}</title>
      <style>
        * { box-sizing: border-box; }
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 18mm;
        }
        body { margin: 0; padding: 24px 16px 40px; background: #e9edf2; color: #263449; font: 12px/1.5 Arial, sans-serif; }
        .print-toolbar { width: 210mm; max-width: 100%; margin: 0 auto 16px; display: flex; justify-content: flex-end; }
        .print-button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border: 0; border-radius: 8px; background: #285ea5; color: #fff; font: 600 13px Arial, sans-serif; cursor: pointer; box-shadow: 0 2px 6px #1d355724; }
        .print-button:hover { background: #214e8b; }
        .print-button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .sheet { width: 210mm; min-height: 297mm; display: flex; flex-direction: column; margin: 0 auto; padding: 14mm; background: #fff; border: 1px solid #dce2ea; box-shadow: 0 8px 30px #26344918; }
        .sheet > * { flex-shrink: 0; }
        .report-header { display: flex; align-items: center; gap: 22px; padding-bottom: 18px; border-bottom: 2px solid #285ea5; }
        .report-header img { display: block; width: 130px; height: auto; }
        h1 { margin: 0; font-size: 20px; font-weight: 700; color: #203e69; }
        .report-header p { margin: 3px 0 0; color: #697586; font-size: 11px; }
        .report-meta { display: flex; justify-content: space-between; gap: 16px; margin: 18px 0; color: #697586; font-size: 11px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
        th { padding: 9px 6px; background: #f0f3f7; color: #42546c; text-align: left; font-weight: 700; border-top: 1px solid #dce2ea; border-bottom: 1px solid #dce2ea; }
        td { padding: 9px 6px; vertical-align: top; border-bottom: 1px solid #e3e8ef; overflow-wrap: anywhere; }
        ${(data.columnWidths ?? []).map((width, index) => `th:nth-child(${index + 1}) { width: ${Number.isFinite(width) && width > 0 ? width : 0}%; }`).join(' ')}
        td:first-child { font-weight: 700; color: #203e69; }
        thead { display: table-header-group; } tr { break-inside: avoid; }
        .instructions { margin: 22px 0 0; padding-top: 14px; border-top: 1px solid #dce2ea; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; color: #59677a; }
        .report-footer { margin-top: auto; padding-top: 24px; font-size: 10px; color: #8591a1; text-align: right; }
        @media screen and (max-width: 820px) { body { padding: 16px 8px; overflow-x: auto; } .print-toolbar { min-width: 210mm; } }
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; }
          .print-toolbar { display: none; }
          .sheet { display: block; width: auto; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; }
          /* Keep the actual footer inside the printable area; margin boxes are not required. */
          .report-footer { display: block; position: fixed; bottom: 0; left: 0; right: 0; margin: 0; padding: 0; }
          .sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .sheet * { -webkit-text-fill-color: currentColor; }
        }
      </style></head><body>
      <div class="print-toolbar"><button class="print-button" type="button" onclick="window.print()">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9V3h12v6"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><path d="M6 14h12v8H6z"></path></svg>Imprimir</button></div>
      <main class="sheet">
        <header class="report-header"><img src="${this.escapeHtml(data.logoUrl)}" alt="${this.escapeHtml(data.brandName)}"><div><h1>${this.escapeHtml(data.title)}</h1><p>${this.escapeHtml(data.subtitle)}</p></div></header>
        <div class="report-meta"><span>Emissão: ${this.escapeHtml(issuedAt.toLocaleString('pt-BR', { timeZone: data.timeZone ?? 'America/Sao_Paulo' }))}</span><span>${data.rows.length} ${this.escapeHtml(data.itemLabel)}</span></div>
        <table><thead><tr>${data.columns.map((column) => `<th scope="col">${this.escapeHtml(column)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
        ${data.instructions.trim() ? `<p class="instructions">${this.escapeHtml(data.instructions)}</p>` : ''}
        <footer class="report-footer">${this.escapeHtml(data.footerText)}</footer>
      </main></body></html>
    `;
  }
}

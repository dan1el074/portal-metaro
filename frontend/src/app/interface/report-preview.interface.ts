export interface ReportPreviewData {
  title: string;
  previewTitle: string;
  subtitle: string;
  brandName: string;
  logoUrl: string;
  footerText: string;
  itemLabel: string;
  fileNamePrefix: string;
  columns: readonly string[];
  columnWidths?: readonly number[];
  rows: readonly (readonly string[])[];
  metadata: readonly string[];
  instructions: string;
  timeZone?: string;
}

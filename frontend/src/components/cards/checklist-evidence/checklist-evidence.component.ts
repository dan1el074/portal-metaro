import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import QRCode from 'qrcode';
import { Evidence } from '../../../app/interface/checklist.interface';
import { ChecklistMediaPreviewService } from '../../../app/services/checklist-media-preview.service';
import { ChecklistIconComponent } from '../../icons/checklist-icon/checklist-icon.component';
import { environment } from '../../../environments/environment';
import { VideoModalComponent } from '../../modal/media/video-modal/video-modal.component';

interface PresentedEvidence extends Evidence {
  source?: string;
  qrCode?: string;
}

@Component({
  selector: 'app-checklist-evidence',
  imports: [ChecklistIconComponent, VideoModalComponent],
  templateUrl: './checklist-evidence.component.html',
  styleUrl: './checklist-evidence.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistEvidenceComponent implements OnChanges {
  @Input() media: Evidence[] = [];
  protected presented: PresentedEvidence[] = [];
  protected selectedVideo: { name: string; safeUrl: SafeResourceUrl } | null = null;
  private readonly previews = inject(ChecklistMediaPreviewService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);

  ngOnChanges(): void {
    this.presented = this.media.map((item) => {
      const publicUrl = item.publicUrl?.startsWith('/') ? environment.apiUrl + item.publicUrl : item.publicUrl;
      const previewUrl = item.previewUrl?.startsWith('/') ? environment.apiUrl + item.previewUrl : item.previewUrl;
      return ({
      ...item, publicUrl, previewUrl,
      source: item.dataUrl || this.previews.get(item.id),
    }); });
    void this.createQrCodes();
  }

  protected isImage(item: Evidence): boolean {
    return item.type.startsWith('image/');
  }

  protected isVideo(item: Evidence): boolean {
    return item.type.startsWith('video/');
  }

  protected openImage(item: PresentedEvidence): void {
    const url = item.source || item.publicUrl;
    if (!url || !/^(blob:|data:image\/|https?:\/\/)/i.test(url)) return;
    const imageWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (imageWindow) imageWindow.opener = null;
  }

  protected openVideo(item: PresentedEvidence): void {
    if (!item.publicUrl) return;
    this.selectedVideo = { name: item.name, safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(item.publicUrl) };
  }

  protected closeVideo(): void {
    this.selectedVideo = null;
  }

  private async createQrCodes(): Promise<void> {
    await Promise.all(this.presented.map(async (item) => {
      if (!this.isVideo(item) || !item.publicUrl) return;
      item.qrCode = await QRCode.toDataURL(item.publicUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 220,
        color: { dark: '#111111', light: '#ffffff' },
      });
    }));
    this.cdr.markForCheck();
  }
}

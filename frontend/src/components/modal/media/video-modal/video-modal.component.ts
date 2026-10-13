import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl } from '@angular/platform-browser';
import { BackNavigationService } from '../../../../app/services/back-navigation.service';

@Component({
  selector: 'app-video-modal',
  imports: [
    CommonModule
  ],
  templateUrl: './video-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './video-modal.component.scss',
})
export class VideoModalComponent implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Input() video: { name: string; safeUrl: SafeResourceUrl } | null = null;
  @Output() close = new EventEmitter<void>();
  private historyRegistered = false;

  constructor(private backNavigation: BackNavigationService) {}

  public ngOnChanges(): void {
    if (this.visible && this.video) {
      this.registerBackNavigation();
    } else {
      this.unregisterBackNavigation();
    }
  }

  public ngOnDestroy(): void {
    this.unregisterBackNavigation();
  }

  protected onClose(): void {
    this.close.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  private registerBackNavigation(): void {
    if (this.historyRegistered) return;

    this.historyRegistered = true;
    this.backNavigation.register(() => {
      this.historyRegistered = false;
      this.close.emit();
    });
  }

  private unregisterBackNavigation(): void {
    if (!this.historyRegistered) return;

    this.historyRegistered = false;
    this.backNavigation.unregister();
  }
}

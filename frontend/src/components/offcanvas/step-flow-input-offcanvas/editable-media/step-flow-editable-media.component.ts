import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StepFlowImage } from '../../../../app/interface/image.interface';
import { StepFlowOrder, StepFlowVideo, UploadingVideo } from '../../../../app/interface/step-flow.interface';
import { getSortedStepFlowMedia, matchesStepFlowMediaSearch, StepFlowMedia, StepFlowMediaFilter } from '../../../../app/interface/step-flow-media.interface';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-step-flow-editable-media',
  imports: [CommonModule, FormsModule, NgTemplateOutlet],
  templateUrl: './step-flow-editable-media.component.html',
  styleUrl: './step-flow-editable-media.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StepFlowEditableMediaComponent {
  @ViewChild('mediaSearchInput') mediaSearchInput?: ElementRef<HTMLInputElement>;
  @Input({ required: true }) order!: StepFlowOrder;
  @Input() uploadingVideos: UploadingVideo[] = [];
  @Output() deleteImage = new EventEmitter<StepFlowImage>();
  @Output() deleteVideo = new EventEmitter<StepFlowVideo>();
  @Output() openVideo = new EventEmitter<StepFlowVideo>();

  protected readonly apiUrl = environment.apiUrl;
  protected mediaFilter: StepFlowMediaFilter = 'all';
  protected mediaSearch = '';
  protected mediaSearchOpen = false;
  protected showAllMedia = false;

  protected get filteredMedia(): StepFlowMedia[] {
    return getSortedStepFlowMedia(this.order.pictures, this.order.videos, this.mediaFilter, this.mediaSearch);
  }

  protected get filteredUploadingVideos(): UploadingVideo[] {
    if (this.mediaFilter === 'image') return [];
    return this.uploadingVideos.filter(video => matchesStepFlowMediaSearch(video.name, this.mediaSearch));
  }

  protected get visibleUploadingVideos(): UploadingVideo[] {
    return this.showAllMedia ? this.filteredUploadingVideos : this.filteredUploadingVideos.slice(0, 4);
  }

  protected get visibleMedia(): StepFlowMedia[] {
    if (this.showAllMedia) return this.filteredMedia;
    const remainingSlots = Math.max(0, 4 - this.visibleUploadingVideos.length);
    return this.filteredMedia.slice(0, remainingSlots);
  }

  protected get hasMoreThanFourMedia(): boolean {
    return this.filteredUploadingVideos.length + this.filteredMedia.length > 4;
  }

  protected setMediaFilter(filter: StepFlowMediaFilter): void {
    this.mediaFilter = filter;
    this.showAllMedia = this.mediaSearchOpen;
  }

  protected toggleMediaSearch(): void {
    this.mediaSearchOpen = !this.mediaSearchOpen;
    if (!this.mediaSearchOpen) {
      this.mediaSearch = '';
      this.showAllMedia = false;
      return;
    }
    this.showAllMedia = true;
    setTimeout(() => this.mediaSearchInput?.nativeElement.focus());
  }

  protected showMoreMedia(): void {
    this.showAllMedia = true;
  }

  protected showLessMedia(): void {
    this.showAllMedia = false;
    if (this.mediaSearchOpen) {
      this.mediaSearchOpen = false;
      this.mediaSearch = '';
    }
  }

  protected onPreviewError(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }
}

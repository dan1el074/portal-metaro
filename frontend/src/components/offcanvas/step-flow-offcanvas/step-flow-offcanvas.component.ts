import { ChangeDetectorRef, Component, Input, LOCALE_ID, ChangeDetectionStrategy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastrService } from '../../../app/services/toast.service';
import { AccordionButtonDirective, AccordionComponent, AccordionItemComponent, ButtonCloseDirective, ButtonDirective, OffcanvasService, Tabs2Module, TemplateIdDirective } from '@coreui/angular';
import { StepFlowService } from '../../../app/services/step-flow.service';
import { StepFlowChecklistEquipment, StepFlowOrder, StepFlowVideo } from '../../../app/interface/step-flow.interface';
import localePt from '@angular/common/locales/pt';
import { CommonModule, registerLocaleData } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BackNavigationService } from '../../../app/services/back-navigation.service';
import { VideoModalComponent } from '../../modal/media/video-modal/video-modal.component';
import { StepFlowTimelineComponent } from './timeline/step-flow-timeline.component';
import { StepFlowOrderItemsComponent } from './order-items/step-flow-order-items.component';
import { StepFlowMediaListComponent } from './media-list/step-flow-media-list.component';

registerLocaleData(localePt);

@Component({
  selector: 'app-step-flow-offcanvas',
  imports: [
    CommonModule,
    RouterLink,
    ButtonCloseDirective,
    Tabs2Module,
    ButtonDirective,
    AccordionComponent,
    AccordionItemComponent,
    TemplateIdDirective,
    AccordionButtonDirective,
    VideoModalComponent,
    StepFlowTimelineComponent,
    StepFlowOrderItemsComponent,
    StepFlowMediaListComponent,
  ],
  providers: [{ provide: LOCALE_ID, useValue: 'pt-BR' }],
  templateUrl: './step-flow-offcanvas.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './step-flow-offcanvas.component.scss',
})
export class StepFlowOffcanvasComponent {
  @Input() isAdmin!: boolean;
  @Input() showMoney!: boolean;
  protected order: StepFlowOrder | null = null;
  protected orderId: number | null = null;
  protected visible = false;
  protected showVideoModal = false;
  protected selectedVideo: (StepFlowVideo & { safeUrl: SafeResourceUrl }) | null = null;
  protected checklistEquipment: StepFlowChecklistEquipment[] = [];
  protected checklistEquipmentLoading = false;
  protected get linkedChecklistEquipment(): StepFlowChecklistEquipment[] { return this.checklistEquipment.filter((item) => item.selected); }

  constructor(
    private stepFlowService: StepFlowService,
    private toasterService: ToastrService,
    private cdf: ChangeDetectorRef,
    private backNav: BackNavigationService,
    private sanitizer: DomSanitizer
  ) {}

  public open(orderId: number): void {
    this.visible = true;
    this.orderId = orderId;
    this.getData();
    this.backNav.register(() => this.close());
  }

  public close(): void {
    this.visible = false;
    this.cdf.detectChanges();
  }

  protected getData(): void {
    this.order = null;
    this.checklistEquipment = [];

    if (this.orderId) {
      this.stepFlowService.findById(this.orderId).subscribe({
        next: data => {
          this.order = data;
          this.loadChecklistEquipment();
          this.cdf.detectChanges();
        },
        error: () => {
          this.toasterService.error('Erro ao buscar informações do pedido!')
        }
      });

      return;
    }

    this.toasterService.error('O número da ordem é nulo!')
  }

  private loadChecklistEquipment(): void {
    if (!this.orderId) return;
    this.checklistEquipmentLoading = true;
    this.stepFlowService.listChecklistEquipment(this.orderId).subscribe({
      next: (equipment) => {
        this.checklistEquipment = equipment;
        this.checklistEquipmentLoading = false;
        this.cdf.detectChanges();
      },
      error: () => {
        this.checklistEquipment = [];
        this.checklistEquipmentLoading = false;
        this.cdf.detectChanges();
      },
    });
  }

  protected onOpenVideoModal(video: StepFlowVideo): void {
    this.selectedVideo = { ...video, safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(video.viewUrl) };
    this.showVideoModal = true;
  }

  protected onCloseVideoModal(): void {
    this.showVideoModal = false;
    this.selectedVideo = null;
  }

}

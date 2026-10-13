import { ChangeDetectorRef, Component, computed, ElementRef, EventEmitter, Input, Output, signal, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ToastrService } from '../../../app/services/toast.service';
import { finalize } from 'rxjs';
import { Upload } from 'tus-js-client';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormLabelDirective, FormSelectDirective, SpinnerComponent } from '@coreui/angular';
import { CancelStepFlowModalComponent } from '../../modal/step-flow/cancel-step-flow-modal/cancel-step-flow-modal.component';
import { DeletableStepFlowMedia, DeleteStepFlowMediaModalComponent } from '../../modal/step-flow/delete-step-flow-media-modal/delete-step-flow-media-modal.component';
import { UnsavedChangesStepFlowModalComponent } from '../../modal/step-flow/unsaved-changes-step-flow-modal/unsaved-changes-step-flow-modal.component';
import { VideoModalComponent } from '../../modal/media/video-modal/video-modal.component';
import { CurrencyMaskDirective } from './../../../app/directive/currency-mask.directive';
import { StepFlowVideosService } from './../../../app/services/step-flow-videos.service';
import { BackNavigationService } from '../../../app/services/back-navigation.service';
import { StepFlowService } from '../../../app/services/step-flow.service';
import { Step, StepFlowOrder, StepFlowOrderItem, StepFlowVideo, UploadingVideo, UploadedFile } from '../../../app/interface/step-flow.interface';
import { StepFlowImage } from '../../../app/interface/image.interface';
import { EditableItem, QuantityStepFlowModalComponent } from '../../modal/step-flow/quantity-step-flow-modal/quantity-step-flow-modal.component';
import { StepFlowHistoryComponent } from './history/step-flow-history.component';
import { StepFlowEditableMediaComponent } from './editable-media/step-flow-editable-media.component';
import { StepFlowUploadComponent } from './upload/step-flow-upload.component';

@Component({
  selector: 'app-step-flow-input-offcanvas',
  imports: [
    CommonModule,
    ButtonDirective,
    ButtonCloseDirective,
    ReactiveFormsModule,
    FormsModule,
    FormSelectDirective,
    FormControlDirective,
    FormLabelDirective,
    CurrencyMaskDirective,
    CancelStepFlowModalComponent,
    SpinnerComponent,
    VideoModalComponent,
    StepFlowHistoryComponent,
    StepFlowEditableMediaComponent,
    StepFlowUploadComponent,
    QuantityStepFlowModalComponent,
    DeleteStepFlowMediaModalComponent,
    UnsavedChangesStepFlowModalComponent
  ],
  templateUrl: './step-flow-input-offcanvas.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './step-flow-input-offcanvas.component.scss',
})
export class StepFlowInputOffcanvasComponent {
  @ViewChild('filesSection') filesSection?: ElementRef<HTMLDivElement>;
  @Input() orderId!: number;
  @Input() isAdmin!: boolean;
  @Input() steps!: Array<Step>;
  @Output() nextStepTask = new EventEmitter<number>();
  @Output() reloadOrders = new EventEmitter<void>();

  protected order: StepFlowOrder | null = null;
  protected loading: boolean = true;
  protected visible = false;
  protected form!: FormGroup;
  protected itemsForm!: FormArray;
  protected showCancelModal = false;
  protected adminStepControl = new FormControl<number | null>(null);
  protected saveLoading: boolean = false;
  protected nextStepLoading: boolean = false;
  protected showEditQuantityModal = false;
  protected editingItem: EditableItem | null = null;
  protected showNextStepConfirmationModal = false;
  protected mediaToDelete: DeletableStepFlowMedia | null = null;
  protected deleteMediaLoading = false;
  protected editingFileId: string | null = null;
  protected editingFileName = '';
  protected editingFileExtension = '';
  private initialCurrentStepFormValue = '';
  private initialProducedQuantities = new Map<number, number>();

  // file
  protected readonly isMobileDevice: boolean = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  readonly acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  readonly acceptedExtensions = '.png,.jpeg,.jpg,.webp';
  readonly acceptedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
  readonly acceptedVideoExtensions = '.mp4,.webm,.mov';
  readonly acceptedAllExtensions = this.acceptedExtensions + ',' + this.acceptedVideoExtensions;
  protected isDragOver = signal(false);
  protected files = signal<Array<UploadedFile>>([]);
  protected hasFiles = computed(() => this.files().length > 0);
  protected uploadingVideos = signal<Array<UploadingVideo>>([]);
  protected showVideoModal = false;
  protected selectedVideo: (StepFlowVideo & { safeUrl: SafeResourceUrl }) | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private stepFlowService: StepFlowService,
    private stepFlowVideoService: StepFlowVideosService,
    private toasterService: ToastrService,
    private cdf: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private backNav: BackNavigationService
  ) {
    this.form = this.formBuilder.group({
      carrier: [''],
      shippment: [null],
      volumes: [null],
      length: [null],
      width: [null],
      height: [null],
      weight: [null],
      comment: [''],
    });

    this.itemsForm = this.formBuilder.array([]);
    this.captureFormInitialValue();
  }

  protected get itemsFormControls(): Array<FormGroup> {
    return this.itemsForm.controls as Array<FormGroup>;
  }

  public open(id: number): void {
    this.visible = true;
    this.orderId = id;
    this.resetForm();
    this.loadOrder();
    this.backNav.register(() => this.hide());
  }

  public close(): void {
    this.visible = false;
    this.toggleCancelModel(false);
    this.showNextStepConfirmationModal = false;
    this.resetDeleteMediaModal();
    this.backNav.unregister();
  }

  private hide(): void {
    this.visible = false;
    this.toggleCancelModel(false);
    this.showNextStepConfirmationModal = false;
    this.resetDeleteMediaModal();
  }

  private resetForm(): void {
    this.form.reset({
      carrier: '',
      shippment: null,
      volumes: null,
      length: null,
      width: null,
      height: null,
      weight: null,
      comment: '',
    });
    this.files.set([]);
    this.cancelFileNameEdit();
    this.captureFormInitialValue();
  }

  protected loadOrder(): void {
    this.loading = true;
    this.order = null;
    this.itemsForm.clear();

    this.stepFlowService.findById(this.orderId).subscribe({
      next: (data: StepFlowOrder) => {
        this.order = data;
        this.populateStepFields(data);
        this.buildItemsForm(data.items);
        this.loading = false;
        this.cdf.detectChanges();

        if (this.isAdmin) {
          const current = this.steps.find(s => s.title === data.currentStep);
          this.adminStepControl.setValue(current?.id ?? null);
        }
      },
      error: () => {
        this.toasterService.error("Erro ao carregar informações do pedido!");
        this.loading = false;
        this.cdf.detectChanges();
      },
    });
  }

  private populateStepFields(order: StepFlowOrder): void {
    const measurementControls = ['volumes', 'length', 'width', 'height', 'weight'];

    measurementControls.forEach(name => {
      const control = this.form.get(name);
      if (order.currentStep === 'Montagem Final') {
        control?.setValidators([
          Validators.required,
          Validators.min(0),
          Validators.pattern(name === 'volumes' ? /^\d+$/ : /^\d+(\.\d{1,2})?$/),
        ]);
      } else {
        control?.clearValidators();
      }
      control?.updateValueAndValidity({ emitEvent: false });
    });

    this.form.patchValue({
      carrier: order.currentStep === 'Frete' ? order.carrier ?? '' : '',
      shippment: order.currentStep === 'Frete' ? order.shipment ?? null : null,
      volumes: order.currentStep === 'Montagem Final' ? order.volumes : null,
      length: order.currentStep === 'Montagem Final' ? order.length : null,
      width: order.currentStep === 'Montagem Final' ? order.width : null,
      height: order.currentStep === 'Montagem Final' ? order.height : null,
      weight: order.currentStep === 'Montagem Final' ? order.weight : null,
      comment: '',
    });
    this.form.markAsPristine();
    this.captureFormInitialValue();
  }

  private buildItemsForm(items: Array<StepFlowOrderItem>): void {
    this.itemsForm.clear();

    items.forEach(item => {
      this.itemsForm.push(
        this.formBuilder.group({
          id: [item.id],
          code: [item.code],
          description: [item.description],
          quantity: [item.quantity],
          producedQuantity: [
            item.producedQuantity,
            [Validators.required, Validators.min(0), Validators.max(item.quantity)],
          ],
        })
      );
    });

    this.initialProducedQuantities = new Map(
      items.map(item => [item.id, item.producedQuantity] as const)
    );
  }

  protected onSubmit(): void {
    if (!this.commitFileNameEdit()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    let hasQuantityChanges = false;

    if (this.order?.currentStep === 'Montagem Final') {
      if (this.itemsForm.invalid) {
        this.itemsForm.markAllAsTouched();
        return;
      }

      hasQuantityChanges = this.itemsForm.controls.some(
        control => control.get('producedQuantity')?.dirty
      );

      const hasAtLeastOneItem = this.itemsForm.controls.some(
        control => control.get('producedQuantity')?.value > 0
      );

      if (!hasAtLeastOneItem) {
        this.toasterService.error('Informe a quantidade produzida de ao menos um item.');
        return;
      }
    }

    const formData = this.buildFormData();
    const hasPendingVideos = this.files().some(f => f.kind === 'video');

    if (this.isFormDataEmpty(formData) && !hasPendingVideos) {
      this.toasterService.warning('Preencha ao menos um campo ou anexe um arquivo antes de salvar.');
      return;
    }

    if (hasPendingVideos) {
      this.triggerPendingVideoUploads();
      this.scrollToFilesSection();
    }

    if (this.isFormDataEmpty(formData)) {
      return;
    }

    this.saveLoading = true;

    this.stepFlowService.updateStep(this.orderId, formData)
      .pipe(finalize(() => {
        this.saveLoading = false;
        this.cdf.detectChanges();
      }))
      .subscribe({
        next: (data: StepFlowOrder) => {
          this.toasterService.success('Informações atualizada com sucesso.');

          if (hasQuantityChanges) {
            this.close();
            this.reloadOrders.emit();
            return;
          }

          this.order = data;
          this.buildItemsForm(data.items);
          this.resetForm();
          this.populateStepFields(data);

          if (this.isAdmin) {
            const current = this.steps.find(s => s.title === data.currentStep);
            this.adminStepControl.setValue(current?.id ?? null, { emitEvent: false });
            this.adminStepControl.markAsPristine();

            if (formData.has('setStage')) {
              this.reloadOrders.emit();
            }
          }
        },
        error: (error) => {
          if (error.error.status == 422) {
            this.toasterService.error(error.error.error);
            return;
          }
          this.toasterService.error('Erro ao atualizar a etapa.');
        }
      });
  }

  private buildFormData(): FormData {
    const formData = new FormData();
    const { carrier, shippment, volumes, length, width, height, weight, comment } = this.form.value;

    if (this.isAdmin && this.adminStepControl.dirty) {
      const stepId = this.adminStepControl.value;

      if (stepId !== null) {
        formData.append('setStage', String(stepId - 1));
      }
    }

    if (this.order?.currentStep === 'Montagem Final') {
      const itemsPayload = this.itemsForm.value.map((item: any) => ({
        id: item.id,
        producedQuantity: item.producedQuantity,
      }));

      formData.append('itemsJson', JSON.stringify(itemsPayload));
      formData.append('volumes', String(volumes));
      formData.append('length', String(length));
      formData.append('width', String(width));
      formData.append('height', String(height));
      formData.append('weight', String(weight));
    }

    if (this.order?.currentStep === 'Montagem Final' || this.order?.currentStep === 'Expedição') {
      this.files()
        .filter(uploaded => uploaded.kind === 'image')
        .forEach(uploaded => {
          formData.append('images', uploaded.file, uploaded.name);
        });
    }

    if (this.order?.currentStep === 'Frete') {
      this.appendIfNotEmpty(formData, 'carrier', carrier);
      this.appendIfNotEmpty(formData, 'shippment', shippment);
    }

    this.appendIfNotEmpty(formData, 'comment', comment);

    return formData;
  }

  private appendIfNotEmpty(formData: FormData, key: string, value: unknown): void {
    if (value === null || value === undefined) {
      return;
    }

    const stringValue = String(value).trim();
    if (stringValue.length > 0) {
      formData.append(key, stringValue);
    }
  }

  private isFormDataEmpty(formData: FormData): boolean {
    return Array.from(formData.keys()).length === 0;
  }

  protected onNextStep(): void {
    if (this.hasUnsavedCurrentStepChanges()) {
      this.showNextStepConfirmationModal = true;
      return;
    }

    this.advanceToNextStep();
  }

  private hasUnsavedCurrentStepChanges(): boolean {
    return this.getComparableFormValue() !== this.initialCurrentStepFormValue
      || this.haveProducedQuantitiesChanged()
      || this.files().length > 0;
  }

  private captureFormInitialValue(): void {
    this.initialCurrentStepFormValue = this.getComparableFormValue();
  }

  private getComparableFormValue(): string {
    const { carrier, shippment, volumes, length, width, height, weight, comment } = this.form.getRawValue();

    return JSON.stringify({
      carrier: this.normalizeComparableValue(carrier),
      shippment: this.normalizeComparableValue(shippment),
      volumes: this.normalizeComparableValue(volumes),
      length: this.normalizeComparableValue(length),
      width: this.normalizeComparableValue(width),
      height: this.normalizeComparableValue(height),
      weight: this.normalizeComparableValue(weight),
      comment: this.normalizeComparableValue(comment),
    });
  }

  private normalizeComparableValue(value: unknown): unknown {
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      return trimmedValue.length > 0 ? trimmedValue : null;
    }

    return value ?? null;
  }

  private haveProducedQuantitiesChanged(): boolean {
    return this.itemsFormControls.some(itemGroup => {
      const id = itemGroup.get('id')?.value as number;
      const producedQuantity = itemGroup.get('producedQuantity')?.value as number;
      return producedQuantity !== this.initialProducedQuantities.get(id);
    });
  }

  protected onCloseNextStepConfirmationModal(): void {
    this.showNextStepConfirmationModal = false;
  }

  protected onConfirmNextStep(): void {
    this.showNextStepConfirmationModal = false;
    this.advanceToNextStep();
  }

  private advanceToNextStep(): void {
    if (this.nextStepLoading) {
      return;
    }

    const id = this.order?.id as number;
    this.nextStepLoading = true;

    this.stepFlowService.nextStep(id)
      .pipe(finalize(() => {
        this.nextStepLoading = false;
        this.cdf.detectChanges();
      }))
      .subscribe({
        next: () => {
          this.close();
          this.nextStepTask.emit(id);
          this.toasterService.success('Informações atualizada com sucesso.');
        },
        error: (error) => this.toasterService.error(error.error.error),
      });
  }

  protected onDeleteImage(image: StepFlowImage): void {
    this.openDeleteMediaModal(image.id, image.name, 'image');
  }

  protected onDeleteVideo(video: StepFlowVideo): void {
    this.openDeleteMediaModal(video.id, video.name, 'video');
  }

  private openDeleteMediaModal(id: number, name: string, type: 'image' | 'video'): void {
    this.mediaToDelete = { id, name, type };
  }

  protected onCloseDeleteMediaModal(): void {
    if (!this.deleteMediaLoading) {
      this.resetDeleteMediaModal();
    }
  }

  protected onConfirmDeleteMedia(): void {
    if (!this.mediaToDelete || this.deleteMediaLoading) {
      return;
    }

    this.deleteMediaLoading = true;

    if (this.mediaToDelete.type === 'image') {
      this.deleteImage(this.mediaToDelete.id);
      return;
    }

    this.deleteVideo(this.mediaToDelete.id);
  }

  private deleteImage(id: number): void {
    this.stepFlowService.deleteImageById(id)
      .pipe(finalize(() => this.finishDeleteMediaRequest()))
      .subscribe({
      next: () => {
        if (!this.order) throw new Error("This order is null!");

        this.order = {
          ...this.order,
          pictures: this.order.pictures.filter(picture => picture.id !== id),
        };
        this.resetDeleteMediaModal();
        this.cdf.detectChanges();

        this.toasterService.success("Imagem apagada com sucesso!");
      },
      error: () => this.toasterService.error("Erro ao deletar imagem!")
    });
  }

  private deleteVideo(id: number): void {
    this.stepFlowVideoService.deleteById(id)
      .pipe(finalize(() => this.finishDeleteMediaRequest()))
      .subscribe({
      next: () => {
        if (!this.order) throw new Error("This order is null!");
        this.order = {
          ...this.order,
          videos: this.order.videos.filter(video => video.id !== id),
        };
        this.resetDeleteMediaModal();
        this.cdf.detectChanges();
        this.toasterService.success("Vídeo apagado com sucesso!");
      },
      error: () => this.toasterService.error("Erro ao deletar vídeo!"),
    });
  }

  private finishDeleteMediaRequest(): void {
    this.deleteMediaLoading = false;
    this.cdf.detectChanges();
  }

  private resetDeleteMediaModal(): void {
    this.mediaToDelete = null;
  }

  protected toggleCancelModel(status: boolean): void {
    this.showCancelModal = status;
    this.cdf.detectChanges();
  }

  protected onCancel(message: string): void {
    if (this.order?.currentStep != 'PCP') return;

    const formData = new FormData();

    this.appendIfNotEmpty(formData, 'comment', message);
    this.appendIfNotEmpty(formData, 'cancelled', 'true');

    this.stepFlowService.updateStep(this.orderId, formData).subscribe({
      next: () => {
        this.nextStepTask.emit(this.orderId);
        this.close();
        this.toasterService.success('Pedido cancelado com sucesso!');
      },
      error: (error) => {
        if (error.error.status == 422) {
          this.toasterService.error(error.error.error);
          return;
        }

        this.toasterService.error('Erro ao cancelar pedido!');
      }
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

  protected onOpenEditQuantityModal(itemGroup: FormGroup): void {
    this.editingItem = {
      id: itemGroup.get('id')?.value,
      code: itemGroup.get('code')?.value,
      description: itemGroup.get('description')?.value,
      quantity: itemGroup.get('quantity')?.value,
      producedQuantity: itemGroup.get('producedQuantity')?.value ?? 0,
    };
    this.showEditQuantityModal = true;
    this.cdf.detectChanges();
  }

  protected onCloseEditQuantityModal(): void {
    this.showEditQuantityModal = false;
    this.editingItem = null;
  }

  protected onSaveEditQuantity(newQuantity: number): void {
    const control = this.itemsFormControls.find(
      group => group.get('id')?.value === this.editingItem?.id
    );

    if (control) {
      control.get('producedQuantity')?.setValue(newQuantity);
      control.get('producedQuantity')?.markAsDirty();
    }

    this.onCloseEditQuantityModal();
  }

  // file input
  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles) {
      this.processFiles(Array.from(droppedFiles));
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.processFiles(Array.from(input.files));
      input.value = '';
    }
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  /*
   * Apenas seleciona/valida os arquivos (imagens e vídeos) e os mantém
   * pendentes na mesma lista. Nenhum upload é disparado aqui — isso só
   * acontece quando o usuário clica em "Salvar" (onSubmit).
   */
  private processFiles(newFiles: Array<File>): void {
    const images = newFiles.filter(f => this.acceptedTypes.includes(f.type));
    const videos = newFiles.filter(f => this.acceptedVideoTypes.includes(f.type));
    const invalid = newFiles.filter(f =>
      !this.acceptedTypes.includes(f.type) && !this.acceptedVideoTypes.includes(f.type)
    );

    if (invalid.length > 0) {
      this.toasterService.error('Use apenas PNG, JPEG, JPG, WEBP, MP4, WEBM ou MOV.');
    }

    const mapped: Array<UploadedFile> = [...images, ...videos].map(f => ({
      id: this.generateId(),
      file: f,
      name: f.name,
      size: this.formatSize(f.size),
      kind: this.acceptedTypes.includes(f.type) ? 'image' : 'video',
    }));

    if (mapped.length) {
      this.files.update(current => [...current, ...mapped]);
    }
  }

  /*
   * Move os vídeos pendentes (selecionados, ainda não enviados) da lista de
   * seleção para a lista de "enviando", e dispara o upload TUS de cada um.
   */
  private triggerPendingVideoUploads(): void {
    const pendingVideos = this.files().filter(f => f.kind === 'video');
    if (!pendingVideos.length) return;

    this.files.update(current => current.filter(f => f.kind !== 'video'));

    pendingVideos.forEach(pending => this.uploadVideo(pending.file, pending.name));
  }

  private uploadVideo(file: File, fileName: string): void {
    const tempId = this.generateId();

    this.uploadingVideos.update(current => [
      ...current,
      { tempId, id: null, name: fileName, progress: 0 },
    ]);
    this.cdf.detectChanges();

    this.stepFlowVideoService.create(this.orderId, fileName).subscribe({
      next: (info) => {
        this.uploadingVideos.update(current =>
          current.map(v => (v.tempId === tempId ? { ...v, id: info.id } : v))
        );

        const upload = new Upload(file, {
          endpoint: info.uploadEndpoint,
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: info.authorizationSignature,
            AuthorizationExpire: String(info.authorizationExpire),
            VideoId: info.bunnyVideoId,
            LibraryId: info.libraryId,
          },
          metadata: {
            filetype: file.type,
            title: fileName,
          },
          onError: () => {
            this.toasterService.error('Erro ao enviar o vídeo "' + fileName + '".');
            this.uploadingVideos.update(current => current.filter(v => v.tempId !== tempId));
            this.stepFlowVideoService.deleteById(info.id).subscribe();
            this.cdf.detectChanges();
          },
          onProgress: (bytesSent, bytesTotal) => {
            const progress = Math.round((bytesSent / bytesTotal) * 100);
            this.uploadingVideos.update(current =>
              current.map(v => (v.tempId === tempId ? { ...v, progress } : v))
            );
            this.cdf.detectChanges();
          },
          onSuccess: () => {
            this.stepFlowVideoService.complete(info.id).subscribe({
              next: () => {
                this.uploadingVideos.update(current => current.filter(v => v.tempId !== tempId));
                this.toasterService.success("Vídeo enviado com sucesso!");
                this.loadOrder();
              },
            });
          },
        });

        upload.start();
      },
      error: () => {
        this.toasterService.error(`Erro ao preparar o envio do vídeo.`);
        this.uploadingVideos.update(current => current.filter(v => v.tempId !== tempId));
      },
    });
  }

  private scrollToFilesSection(): void {
    this.cdf.detectChanges();

    setTimeout(() => {
      this.filesSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  protected removeFile(id: string): void {
    this.files.update(current => current.filter(f => f.id !== id));

    if (this.editingFileId === id) {
      this.cancelFileNameEdit();
    }
  }

  protected startFileNameEdit(file: UploadedFile): void {
    if (!this.commitFileNameEdit()) {
      return;
    }

    const extensionIndex = file.name.lastIndexOf('.');
    const hasExtension = extensionIndex > 0;

    this.editingFileId = file.id;
    this.editingFileName = hasExtension ? file.name.slice(0, extensionIndex) : file.name;
    this.editingFileExtension = hasExtension ? file.name.slice(extensionIndex) : '';
  }

  protected onFileNameInput(event: Event): void {
    this.editingFileName = (event.target as HTMLInputElement).value;
  }

  protected saveFileNameEdit(): void {
    this.commitFileNameEdit();
  }

  protected cancelFileNameEdit(): void {
    this.editingFileId = null;
    this.editingFileName = '';
    this.editingFileExtension = '';
  }

  private commitFileNameEdit(): boolean {
    if (!this.editingFileId) {
      return true;
    }

    const name = this.editingFileName.trim();
    if (!name) {
      this.toasterService.warning('Informe um nome para o arquivo.');
      return false;
    }

    const editedFileId = this.editingFileId;
    const fullName = name + this.editingFileExtension;

    this.files.update(current => current.map(file =>
      file.id === editedFileId ? { ...file, name: fullName } : file
    ));
    this.cancelFileNameEdit();
    return true;
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;

    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(0)} KB`;

    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }
}

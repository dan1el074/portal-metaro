import { CommonModule, Location } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { ChecklistMemorando } from '../../../../app/services/checklist.service';
import { BackNavigationService } from '../../../../app/services/back-navigation.service';

@Component({
  selector: 'app-checklist-memorandos-modal',
  imports: [CommonModule, ButtonDirective, ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent, ModalTitleDirective, ModalBackNavigationDirective],
  templateUrl: './checklist-memorandos-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistMemorandosModalComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly backNavigation = inject(BackNavigationService);
  protected visible = false;
  protected memorandos: ChecklistMemorando[] = [];
  protected readonly statuses = { CREATED: 'Rascunho', PUBLISH: 'Publicado', APPROVED: 'Aprovado', CANCELED: 'Cancelado' };

  public open(memorandos: ChecklistMemorando[]): void {
    this.memorandos = memorandos;
    this.visible = true;
    this.cdr.markForCheck();
  }

  protected close(): void {
    this.visible = false;
    this.cdr.markForCheck();
  }

  protected visibleChange(visible: boolean): void {
    if (!visible) this.close();
  }

  protected memorandoUrl(id: number): string {
    return this.location.prepareExternalUrl(this.router.serializeUrl(this.router.createUrlTree(['/general/memorando', id])));
  }

  protected openMemorando(event: MouseEvent, id: number): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.backNavigation.runAfterOverlayClose(() => {
      if (!this.destroyRef.destroyed) void this.router.navigate(['/general/memorando', id]);
    });
    this.close();
    this.cdr.detectChanges();
  }
}

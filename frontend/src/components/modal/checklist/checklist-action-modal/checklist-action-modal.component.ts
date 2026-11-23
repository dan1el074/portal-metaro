import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonCloseDirective,
  ButtonDirective,
  FormControlDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  TooltipDirective,
  SpinnerComponent,
} from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

export interface ChecklistActionModalOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  inputLabel?: string;
  inputValue?: string;
  placeholder?: string;
  required?: boolean;
  danger?: boolean;
  onConfirm?: (value: string) => Promise<void>;
}

@Component({
  selector: 'app-checklist-action-modal',
  imports: [
    FormsModule,
    ButtonCloseDirective,
    ButtonDirective,
    FormControlDirective,
    ModalBodyComponent,
    ModalComponent,
    ModalFooterComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    TooltipDirective,
    SpinnerComponent,
    ModalBackNavigationDirective,
  ],
  templateUrl: './checklist-action-modal.component.html',
  styleUrl: './checklist-action-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistActionModalComponent {
  protected visible = false;
  protected options: ChecklistActionModalOptions = { title: '', message: '' };
  protected value = '';
  protected busy = false;
  protected error = '';
  private resolve?: (value: string | null) => void;

  constructor(private cdr: ChangeDetectorRef) {}

  public open(options: ChecklistActionModalOptions): Promise<string | null> {
    if (this.busy) return Promise.resolve(null);
    if (this.resolve) this.resolve(null);
    this.options = options;
    this.error = '';
    this.value = options.inputValue ?? '';
    this.visible = true;
    this.cdr.detectChanges();
    return new Promise(resolve => (this.resolve = resolve));
  }

  protected async confirm(): Promise<void> {
    if (this.busy || this.options.required && !this.value.trim()) return;
    const value = this.options.inputLabel ? this.value.trim() : 'confirmed';
    if (this.options.onConfirm) {
      this.busy = true;
      this.error = '';
      this.cdr.detectChanges();
      try {
        await this.options.onConfirm(value);
      } catch (error: any) {
        this.error = error?.error?.error || error?.error?.message || error?.message || 'Não foi possível concluir a operação. Tente novamente.';
        return;
      } finally {
        this.busy = false;
        this.cdr.detectChanges();
      }
    }
    this.finish(value);
  }

  protected cancel(): void {
    if (this.busy) return;
    this.finish(null);
  }

  protected onVisibleChange(visible: boolean): void {
    if (this.busy) return;
    this.visible = visible;
    if (!visible && this.resolve) this.finish(null);
  }

  private finish(value: string | null): void {
    const resolve = this.resolve;
    this.resolve = undefined;
    this.visible = false;
    this.cdr.detectChanges();
    resolve?.(value);
  }
}

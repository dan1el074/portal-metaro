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
  private resolve?: (value: string | null) => void;

  constructor(private cdr: ChangeDetectorRef) {}

  public open(options: ChecklistActionModalOptions): Promise<string | null> {
    if (this.resolve) this.resolve(null);
    this.options = options;
    this.value = options.inputValue ?? '';
    this.visible = true;
    this.cdr.detectChanges();
    return new Promise(resolve => (this.resolve = resolve));
  }

  protected confirm(): void {
    if (this.options.required && !this.value.trim()) return;
    const value = this.options.inputLabel ? this.value.trim() : 'confirmed';
    this.finish(value);
  }

  protected cancel(): void {
    this.finish(null);
  }

  protected onVisibleChange(visible: boolean): void {
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

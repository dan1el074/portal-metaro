import { DOCUMENT } from '@angular/common';
import { inject, Injectable, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

export interface ToastOptions {
  enableHtml?: boolean;
  timeOut?: number;
}

type ToastKind = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastrService {
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly activeMessages = new Set<string>();

  success(message: string, title = '', options?: ToastOptions): void {
    this.show('success', message, title, options);
  }

  error(message: string, title = '', options?: ToastOptions): void {
    this.show('error', message, title, options);
  }

  warning(message: string, title = '', options?: ToastOptions): void {
    this.show('warning', message, title, options);
  }

  info(message: string, title = '', options?: ToastOptions): void {
    this.show('info', message, title, options);
  }

  private show(kind: ToastKind, message: string, title: string, options?: ToastOptions): void {
    const signature = `${kind}:${title}:${message}`;
    if (this.activeMessages.has(signature)) {
      return;
    }

    const container = this.getContainer();
    const toast = this.document.createElement('div');
    toast.className = `app-toast app-toast--${kind}`;
    toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

    const content = this.document.createElement('div');
    content.className = 'app-toast__content';

    if (title) {
      const heading = this.document.createElement('strong');
      heading.className = 'app-toast__title';
      heading.textContent = title;
      content.appendChild(heading);
    }

    const body = this.document.createElement('div');
    body.className = 'app-toast__message';
    if (options?.enableHtml) {
      body.innerHTML = this.sanitizer.sanitize(SecurityContext.HTML, message) ?? '';
    } else {
      body.textContent = message;
    }
    content.appendChild(body);
    toast.appendChild(content);

    const closeButton = this.document.createElement('button');
    closeButton.className = 'app-toast__close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Fechar notificação');
    closeButton.textContent = '×';
    toast.appendChild(closeButton);

    const progress = this.document.createElement('div');
    progress.className = 'app-toast__progress';
    const timeOut = options?.timeOut ?? 3000;
    progress.style.animationDuration = `${timeOut}ms`;
    toast.appendChild(progress);

    const remove = (): void => {
      this.activeMessages.delete(signature);
      toast.remove();
      if (!container.childElementCount) {
        container.remove();
      }
    };

    toast.addEventListener('click', remove, { once: true });
    progress.addEventListener('animationend', remove, { once: true });
    this.activeMessages.add(signature);
    container.appendChild(toast);
  }

  private getContainer(): HTMLElement {
    const existing = this.document.querySelector<HTMLElement>('.app-toast-container');
    if (existing) {
      return existing;
    }

    const container = this.document.createElement('div');
    container.className = 'app-toast-container';
    container.setAttribute('aria-live', 'polite');
    this.document.body.appendChild(container);
    return container;
  }
}

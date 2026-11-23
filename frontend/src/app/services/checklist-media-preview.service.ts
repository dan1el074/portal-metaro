import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ChecklistMediaPreviewService {
  private readonly urls = new Map<string, string>();
  private readonly files = new Map<string, File>();

  register(id: string, file: File): void {
    this.remove(id);
    this.files.set(id, file);
    this.urls.set(id, URL.createObjectURL(file));
  }

  get(id: string): string | undefined {
    return this.urls.get(id);
  }

  getFile(id: string): File | undefined {
    return this.files.get(id);
  }

  remove(id: string): void {
    const url = this.urls.get(id);
    if (url) URL.revokeObjectURL(url);
    this.urls.delete(id);
    this.files.delete(id);
  }
}

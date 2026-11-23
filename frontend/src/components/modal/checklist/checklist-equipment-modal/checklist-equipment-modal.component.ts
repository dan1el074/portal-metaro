import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { firstValueFrom } from 'rxjs';
import { Equipment } from '../../../../app/interface/checklist.interface';
import { ChecklistService } from '../../../../app/services/checklist.service';
import { ToastrService } from '../../../../app/services/toast.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { ChecklistActionModalComponent } from '../checklist-action-modal/checklist-action-modal.component';

@Component({ selector: 'app-checklist-equipment-modal', imports: [FormsModule, ButtonCloseDirective, ButtonDirective, FormControlDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective, ChecklistIconComponent, ChecklistActionModalComponent], templateUrl: './checklist-equipment-modal.component.html', styleUrl: './checklist-equipment-modal.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistEquipmentModalComponent {
  @ViewChild(ChecklistActionModalComponent) private actionModal!: ChecklistActionModalComponent;
  @Output() readonly changed = new EventEmitter<void>();
  protected visible = false;
  protected busy = false;
  protected listError = false;
  protected equipment: Equipment[] = [];
  protected name = '';
  protected abbreviation = '';
  protected editingId = '';

  constructor(private api: ChecklistService, private toaster: ToastrService, private cdr: ChangeDetectorRef) {}

  public open(): void {
    this.visible = true;
    this.resetForm();
    this.equipment = [];
    void this.load();
  }

  protected async load(): Promise<void> {
    this.busy = true;
    this.listError = false;
    this.cdr.markForCheck();
    try {
      this.equipment = (await firstValueFrom(this.api.listEquipment())).map(item => ({ ...item, id: String(item.id) }));
    } catch {
      this.listError = true;
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  protected close(): void { this.visible = false; this.resetForm(); this.cdr.markForCheck(); }

  protected async save(): Promise<void> {
    if (this.busy || this.listError) return;
    const name = this.name.trim();
    const abbreviation = this.abbreviation.trim().toLocaleUpperCase('pt-BR');
    if (!name || !abbreviation) return;
    const others = this.equipment.filter(item => item.id !== this.editingId);
    if (others.some(item => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { this.toaster.warning('Nome já utilizado.'); return; }
    if (others.some(item => item.abbreviation.toLocaleLowerCase() === abbreviation.toLocaleLowerCase())) { this.toaster.warning('Abreviação já utilizada.'); return; }
    const value = { id: this.editingId, name, abbreviation };
    await this.mutate(() => firstValueFrom(value.id ? this.api.updateEquipment(value) : this.api.createEquipment(value)),
      'Não foi possível salvar o equipamento.');
  }

  protected edit(item: Equipment): void {
    this.editingId = item.id;
    this.name = item.name;
    this.abbreviation = item.abbreviation;
  }

  protected cancelEdit(): void { this.resetForm(); }

  protected async remove(id: string): Promise<void> {
    if (this.busy) return;
    const confirmed = await this.openAction({
      title: 'Excluir equipamento', message: 'O equipamento será excluído definitivamente.',
      confirmLabel: 'Excluir', danger: true,
    });
    if (!confirmed) return;
    await this.mutate(() => firstValueFrom(this.api.deleteEquipment(id)), 'Não foi possível excluir o equipamento.');
  }

  private async mutate(request: () => Promise<unknown>, failure: string): Promise<void> {
    this.busy = true;
    try {
      await request();
      this.changed.emit();
      this.resetForm();
      await this.load();
    } catch (error) {
      this.toaster.warning((error as { error?: { error?: string } }).error?.error || failure);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private resetForm(): void { this.editingId = ''; this.name = ''; this.abbreviation = ''; }
  private async openAction(options: Parameters<ChecklistActionModalComponent['open']>[0]): Promise<string | null> { this.visible = false; this.cdr.detectChanges(); await new Promise(resolve => setTimeout(resolve, 180)); const result = await this.actionModal.open(options); await new Promise(resolve => setTimeout(resolve, 180)); this.visible = true; this.cdr.detectChanges(); return result; }
}

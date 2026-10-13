import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { checklistCopy as copy, checklistId as uid } from '../../../../app/shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ToastrService } from '../../../../app/services/toast.service';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { ChecklistActionModalComponent } from '../checklist-action-modal/checklist-action-modal.component';

@Component({ selector: 'app-checklist-equipment-modal', imports: [FormsModule, ButtonCloseDirective, ButtonDirective, FormControlDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective, ChecklistIconComponent, ChecklistActionModalComponent], templateUrl: './checklist-equipment-modal.component.html', styleUrl: './checklist-equipment-modal.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistEquipmentModalComponent {
  @ViewChild(ChecklistActionModalComponent) private actionModal!: ChecklistActionModalComponent;
  protected visible = false;
  protected name = '';
  protected abbreviation = '';
  protected editingId = '';
  constructor(protected store: ChecklistPreviewService, private toaster: ToastrService, private cdr: ChangeDetectorRef) {}
  public open(): void { this.visible = true; this.cdr.detectChanges(); }
  protected close(): void { this.visible = false; this.resetForm(); this.cdr.detectChanges(); }
  protected save(): void {
    const name = this.name.trim();
    const abbreviation = this.abbreviation.trim().toLocaleUpperCase('pt-BR');
    if (!name || !abbreviation) return;
    const data = copy(this.store.state());
    if (data.equipment.some(item => item.id !== this.editingId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { this.toaster.warning('Nome já utilizado.'); return; }
    if (data.equipment.some(item => item.id !== this.editingId && item.abbreviation.toLocaleLowerCase() === abbreviation.toLocaleLowerCase())) { this.toaster.warning('Abreviação já utilizada.'); return; }
    if (this.editingId) {
      const equipment = data.equipment.find(item => item.id === this.editingId)!;
      equipment.name = name;
      equipment.abbreviation = abbreviation;
      data.templates.filter(item => item.equipmentId === equipment.id).forEach(template => {
        const category = data.categories.find(item => item.id === template.categoryId);
        if (category?.integration === 'production') template.name = abbreviation;
      });
    } else {
      data.equipment.push({ id: uid(), name, abbreviation });
    }
    this.store.commit(data);
    this.resetForm();
    this.cdr.detectChanges();
  }
  protected edit(id: string): void {
    const current = this.store.state().equipment.find(item => item.id === id)!;
    this.editingId = id;
    this.name = current.name;
    this.abbreviation = current.abbreviation;
  }
  protected cancelEdit(): void { this.resetForm(); }
  protected async remove(id: string): Promise<void> { const data = copy(this.store.state()); if (data.templates.some(item => item.equipmentId === id) || data.flows.some(flow => flow.plan.some(step => step.template.equipmentId === id))) { this.toaster.warning('Equipamentos utilizados não podem ser excluídos.'); return; } const confirmed = await this.openAction({ title: 'Excluir equipamento', message: 'O equipamento será excluído definitivamente.', confirmLabel: 'Excluir', danger: true }); if (!confirmed) return; data.equipment = data.equipment.filter(item => item.id !== id); this.store.commit(data); this.cdr.detectChanges(); }
  private resetForm(): void { this.editingId = ''; this.name = ''; this.abbreviation = ''; }
  private async openAction(options: Parameters<ChecklistActionModalComponent['open']>[0]): Promise<string | null> { this.visible = false; this.cdr.detectChanges(); await new Promise(resolve => setTimeout(resolve, 180)); const result = await this.actionModal.open(options); await new Promise(resolve => setTimeout(resolve, 180)); this.visible = true; this.cdr.detectChanges(); return result; }
}

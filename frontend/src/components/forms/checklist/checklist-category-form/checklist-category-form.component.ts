import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FormCheckInputDirective, FormControlDirective, FormSelectDirective, TooltipDirective } from '@coreui/angular';
import { Category, Field } from '../../../../app/interface/checklist.interface';
import { emptyChecklistField as emptyField } from '../../../../app/shared/checklist-factory';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';

@Component({
  selector: 'app-checklist-category-form',
  imports: [FormsModule, FormCheckInputDirective, FormControlDirective, FormSelectDirective, TooltipDirective, ChecklistIconComponent],
  templateUrl: './checklist-category-form.component.html',
  styleUrl: './checklist-category-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistCategoryFormComponent {
  @Input({ required: true }) category!: Category;
  @Output() integrationChange = new EventEmitter<void>();
  protected readonly fieldTypes = [
    { value: 'text', label: 'Texto curto' }, { value: 'textarea', label: 'Texto longo' },
    { value: 'number', label: 'Número' }, { value: 'date', label: 'Data' },
    { value: 'datetime-local', label: 'Data/hora' }, { value: 'select', label: 'Seleção única' },
  ];

  protected addField(): void { this.category.fields.push(emptyField()); }
  protected removeField(index: number): void { this.category.fields.splice(index, 1); }
  protected setOptions(field: Field, value: string): void { field.options = value.split(';').map(option => option.trim()).filter(Boolean); }
}

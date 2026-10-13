import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Field } from '../../../../app/interface/checklist.interface';

@Component({
  selector: 'app-checklist-field',
  imports: [FormsModule],
  templateUrl: './checklist-field.component.html',
  styleUrl: './checklist-field.component.scss',
})
export class ChecklistFieldComponent {
  field = input.required<Field>();
  value = model('');
  disabled = input(false);
  updateValue(value: unknown): void {
    this.value.set(value == null ? '' : String(value));
  }
}

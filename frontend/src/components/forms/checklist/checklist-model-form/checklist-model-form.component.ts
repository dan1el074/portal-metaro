import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, QueryList, ViewChildren } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective, CardBodyComponent, CardComponent, FormCheckInputDirective, FormControlDirective, FormSelectDirective, TooltipDirective } from '@coreui/angular';
import { Field, Template } from '../../../../app/interface/checklist.interface';
import { emptyChecklistField as emptyField, emptyChecklistQuestion as emptyQuestion, emptyChecklistSection as emptySection } from '../../../../app/shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { checklistIntegrationLabel } from '../../../../app/shared/checklist-rules';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';

@Component({
  selector: 'app-checklist-model-form',
  imports: [
    CommonModule,
    FormsModule,
    ButtonDirective,
    CardComponent,
    CardBodyComponent,
    FormCheckInputDirective,
    FormControlDirective,
    FormSelectDirective,
    TooltipDirective,
    ChecklistIconComponent,
  ],
  templateUrl: './checklist-model-form.component.html',
  styleUrl: './checklist-model-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChecklistModelFormComponent {
  @ViewChildren(TooltipDirective) private readonly tooltips!: QueryList<TooltipDirective>;
  @Input({ required: true }) model!: Template;
  @Output() modelChange = new EventEmitter<Template>();
  @Output() saveModel = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  protected readonly fieldTrack = (_: number, field: Field) => field.id;
  protected readonly integrationLabel = checklistIntegrationLabel;
  protected readonly fieldTypes = [
    { value: 'text', label: 'Texto curto' },
    { value: 'textarea', label: 'Texto longo' },
    { value: 'number', label: 'Número' },
    { value: 'date', label: 'Data' },
    { value: 'datetime-local', label: 'Data/hora' },
    { value: 'select', label: 'Seleção única' },
  ];

  constructor(protected store: ChecklistPreviewService) {}

  protected get category() {
    return this.store.state().categories.find((item) => item.id === this.model.categoryId);
  }

  protected get titleVariables(): { key: string; label: string }[] {
    const variables = [{ key: '%data', label: 'Data/hora de criação' }];
    if (this.category?.integration === 'production') {
      variables.push(
        { key: '%serie', label: 'Número de série do equipamento' },
        { key: '%pedido', label: 'Número do pedido no ERP' },
        { key: '%cliente', label: 'Cliente do pedido' },
        { key: '%item', label: 'Item selecionado no pedido' },
        { key: '%vendedor', label: 'Vendedor do pedido' },
      );
    }
    this.model.sections.forEach((section, sectionIndex) =>
      section.questions.forEach((question, questionIndex) => {
        const number = `${sectionIndex + 1}.${questionIndex + 1}`;
        variables.push({ key: `%${number}`, label: `Resposta de: ${ question.label || 'Item sem nome'}.` });
      }),
    );
    return variables;
  }

  protected get predecessors() {
    return this.store.state().templates.filter((item) => {
      const predecessorIntegration = this.store.state().categories.find((category) =>
        category.id === item.categoryId)?.integration;
      return item.id !== this.model.id
      && item.categoryId !== this.model.categoryId
      && (!item.predecessorId || !this.store.state().templates.some((candidate) => candidate.predecessorId === item.id))
      && this.category?.integration === predecessorIntegration;
    });
  }

  protected predecessorLabel(template: Template): string {
    const category = this.store.state().categories.find((item) => item.id === template.categoryId);
    return `${category?.name || 'Categoria não encontrada'} - ${template.name}`;
  }

  protected changed(): void {
    this.modelChange.emit(this.model);
  }

  protected categoryChanged(): void {
    this.model.equipmentId = '';
    this.model.predecessorId = '';
    this.model.automatic = false;
    const production = this.category?.integration === 'production';
    if (production) { this.model.name = ''; this.model.signature = true; }
    this.model.sections.forEach((section) => (section.options = production ? ['OK', 'NOK', 'N/A'] : ['OK', 'N/A']));
    this.changed();
  }

  protected equipmentChanged(): void {
    const equipment = this.store.state().equipment.find((item) => item.id === this.model.equipmentId);
    this.model.name = equipment?.abbreviation || '';
    this.changed();
  }

  protected options(sectionIndex: number, value: string): void {
    const options = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
    if (!options.includes('N/A')) options.push('N/A');
    if (this.category?.integration === 'production' && !options.includes('NOK')) options.push('NOK');
    this.model.sections[sectionIndex].options = this.category?.integration === 'production'
      ? options
      : options.filter((option) => option !== 'NOK');
    this.changed();
  }

  protected addSection(): void {
    this.model.sections.push(emptySection(this.category?.integration === 'production'));
    this.changed();
  }

  protected addQuestion(sectionIndex: number): void {
    this.model.sections[sectionIndex].questions.push(emptyQuestion());
    this.changed();
  }

  protected removeSection(index: number): void {
    this.model.sections.splice(index, 1);
    this.changed();
  }

  protected removeQuestion(sectionIndex: number, questionIndex: number): void {
    this.model.sections[sectionIndex].questions.splice(questionIndex, 1);
    this.changed();
  }

  protected addQuestionField(sectionIndex: number, questionIndex: number): void {
    this.model.sections[sectionIndex].questions[questionIndex].fields.push(emptyField());
    this.changed();
  }

  protected removeQuestionField(sectionIndex: number, questionIndex: number, fieldIndex: number): void {
    this.model.sections[sectionIndex].questions[questionIndex].fields.splice(fieldIndex, 1);
    this.changed();
  }

  protected setFieldOptions(field: Field, value: string): void {
    field.options = value.split(';').map((item) => item.trim()).filter(Boolean);
    this.changed();
  }

  protected move<T>(items: T[], index: number, offset: number): void {
    this.tooltips.forEach((tooltip) => tooltip.visible.set(false));
    const target = index + offset;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    this.changed();
  }

  protected fieldChanged(): void {
    this.changed();
  }
}

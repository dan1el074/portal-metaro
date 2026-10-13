import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { AccordionButtonDirective, AccordionComponent, AccordionItemComponent, TemplateIdDirective } from '@coreui/angular';
import { StepFlowOrder, StepFlowOrderStep } from '../../../../app/interface/step-flow.interface';

@Component({
  selector: 'app-step-flow-history',
  imports: [
    CommonModule,
    NgTemplateOutlet,
    AccordionComponent,
    AccordionItemComponent,
    AccordionButtonDirective,
    TemplateIdDirective,
  ],
  templateUrl: './step-flow-history.component.html',
  styleUrl: './step-flow-history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StepFlowHistoryComponent {
  @Input({ required: true }) order!: StepFlowOrder;

  protected hasShippingInfo(step: StepFlowOrderStep): boolean {
    if (step.step === 'Montagem Final') {
      return [this.order.volumes, this.order.length, this.order.width, this.order.height, this.order.weight]
        .some(value => value !== null && value !== undefined);
    }

    if (step.step === 'Frete') {
      return !!this.order.carrier || (step.status === 'DONE' && this.order.shipment !== null && this.order.shipment !== undefined);
    }

    return false;
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { StepFlowOrder } from '../../../../app/interface/step-flow.interface';
import { TruncatePipe } from '../../../../app/pipes/truncate.pipe';

@Component({
  selector: 'app-step-flow-order-items',
  imports: [CommonModule, TruncatePipe],
  templateUrl: './step-flow-order-items.component.html',
  styleUrl: './step-flow-order-items.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class StepFlowOrderItemsComponent {
  @Input({ required: true }) order!: StepFlowOrder;
  @Input() showMoney = false;

  protected get totalVolumes(): number {
    return this.order.volumes.reduce((total, volume) => total + volume.quantity, 0);
  }
}

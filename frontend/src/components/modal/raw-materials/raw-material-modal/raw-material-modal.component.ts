import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormDirective, FormTextDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, ModalToggleDirective } from '@coreui/angular';
import { cilPencil } from '@coreui/icons';
import { IconDirective } from '@coreui/icons-angular';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RawMaterialsTable } from '../../../../app/interface/raw-materials.interface';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';

@Component({
  selector: 'app-raw-material-modal',
  imports: [
    IconDirective,
    ButtonDirective,
    ButtonCloseDirective,
    ModalComponent,
    ModalBackNavigationDirective,
    ModalHeaderComponent,
    ModalTitleDirective,
    ModalBodyComponent,
    ModalFooterComponent,
    ModalToggleDirective,
    ReactiveFormsModule,
    FormsModule,
    FormDirective,
    FormControlDirective,
    FormTextDirective,
    ButtonDirective
  ],
  templateUrl: './raw-material-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './raw-material-modal.component.scss',
})
export class RawMaterialModalComponent implements OnInit {
  @Input() item!: RawMaterialsTable;
  protected icons = { cilPencil };
  protected value!: number;

  ngOnInit(): void {
    this.value = this.item.currentStorage;
  }

  increment(): void {
    this.value++;
  }

  decrement(): void {
    if (this.value > 0) {
      this.value--;
    }
  }
}

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { FormControlDirective } from '@coreui/angular';
import { MultiSelectComponent, MultiSelectOptionComponent } from '@coreui/angular-pro';
import { ToastrService } from '../../../../app/services/toast.service';
import { OrderInfo } from '../../../../app/interface/erp.interface';
import { NewMemorando } from '../../../../app/interface/memorando.interface';
import { PositionMin } from '../../../../app/interface/position.interface';
import { PostitionService } from '../../../../app/services/position.service';

@Component({
  selector: 'app-memorando-form',
  imports: [
    ReactiveFormsModule,
    FormControlDirective,
    MultiSelectComponent,
    MultiSelectOptionComponent
  ],
  templateUrl: './memorando-form.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './memorando-form.component.scss',
})
export class MemorandoFormComponent implements OnInit, OnChanges {
  @Input() orderInfoList!: Array<OrderInfo>;
  @Output() createTask = new EventEmitter<NewMemorando>();
  @Output() exitTask = new EventEmitter<void>();

  protected valid: boolean | undefined;
  protected createForm: FormGroup;
  protected showErrors = false;
  protected departments: Array<PositionMin> = [];

  constructor(
    private formBuilder: FormBuilder,
    private postitionService: PostitionService,
    private toasterService: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.createForm = this.formBuilder.group({
      request: ['', [Validators.required]],
      erpSource: ['FOCCO', [Validators.required]],
      client: ['', [Validators.required, Validators.minLength(5)]],
      items: [[], [Validators.required]],
      title: ['', [Validators.required]],
      description: [ '', [Validators.required, Validators.minLength(5)]],
      reason: ['', [Validators.required, Validators.minLength(5)]],
      departments: [[], [Validators.required]],
      status: ['']
    })
  }

  public ngOnInit(): void {
    this.postitionService.list().subscribe({
      next: departments => {
        this.departments = departments;
        this.cdr.detectChanges();
      },
      error: () => this.toasterService.error('Erro ao buscar departamentos!')
    });
  }

  public ngOnChanges(): void {
    if (this.orderInfoList == null) return;
    if (this.orderInfoList.length <= 0) return;

    this.createForm.reset({
      request: this.orderInfoList[0].number,
      erpSource: this.orderInfoList[0].source,
      client: this.orderInfoList[0].client,
      items: [],
      title: '',
      description: '',
      reason: '',
      departments: []
    });
    this.cdr.detectChanges();
  }

  protected onExit(): void {
    this.createForm.reset({
      request: '',
      erpSource: 'FOCCO',
      client: '',
      items: [],
      title: '',
      description: '',
      reason: '',
      departments: []
    });
    this.exitTask.emit();
  }

  protected onSave(): void {
    this.createForm.patchValue({
      status: 'CREATED'
    });
    this.onSubmit();
  }

  protected onPublish(): void {
    this.createForm.patchValue({
      status: 'PUBLISH'
    });
    this.onSubmit();
  }

  protected onSubmit(): void {
    if (!this.createForm.valid) {
      this.showErrors = true;
      this.createForm.markAllAsTouched();
      this.toasterService.warning('Preencha todos os campos obrigatórios antes de continuar.');
      return;
    }

    this.createForm.patchValue({
      description: this.createForm.get('description')?.value.replace(/\r?\n/g, '<br>')
    });

    for (let i=this.createForm.get('departments')?.value.length-1; i>=0; i--) {
      if (Number(this.createForm.get('departments')?.value[i])) continue;
      this.createForm.get('departments')?.value.splice(i, 1);
    }

    this.createTask.emit(this.createForm.value);
  }
}

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, EventEmitter, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom, forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { NokFormField, Problem } from '../../../../app/interface/checklist.interface';
import { checklistCopy as copy, checklistId as uid } from '../../../../app/shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { nokFieldValue, setNokFieldValue } from '../../../../app/shared/checklist-rules';
import { ChecklistMediaPreviewService } from '../../../../app/services/checklist-media-preview.service';
import { ChecklistService } from '../../../../app/services/checklist.service';

@Component({
  selector: 'app-checklist-nok-modal',
  imports: [
    FormsModule,
    ButtonCloseDirective,
    ButtonDirective,
    FormControlDirective,
    FormSelectDirective,
    ModalBodyComponent,
    ModalComponent,
    ModalFooterComponent,
    ModalHeaderComponent,
    ModalTitleDirective,
    TooltipDirective,
    ModalBackNavigationDirective,
    ChecklistIconComponent
  ],
  templateUrl: './checklist-nok-modal.component.html',
  styleUrl: './checklist-nok-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChecklistNokModalComponent {
  @Output() saved = new EventEmitter<Problem[]>();
  protected visible=false;
  protected problems:Problem[]=[];
  protected newItem='';
  protected newItemProblemId='';
  protected departments:string[]=[];
  protected loadingOptions = false;
  protected optionsError = false;
  protected addingItem = false;
  protected itemError = false;
  private optionsLoaded = false;
  private items: string[] = [];
  private defects: string[] = [];
  private readonly destroyRef = inject(DestroyRef);
  private removedMediaIds=new Set<string>();
  private addedMediaIds=new Set<string>();

  constructor(
    protected store:ChecklistPreviewService,
    private cdr:ChangeDetectorRef,
    private mediaPreview:ChecklistMediaPreviewService,
    private api:ChecklistService
  ){}

  protected loadOptions(): void {
    if (this.optionsLoaded || this.loadingOptions) return;
    this.loadingOptions = true;
    this.optionsError = false;
    forkJoin({
      items: this.api.listCatalog('ITEM'),
      defects: this.api.listCatalog('DEFECT'),
      departments: this.api.listDepartments(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ items, defects, departments }) => {
        this.items = items.filter(item => item.active).map(item => item.name);
        this.defects = defects.filter(item => item.active).map(item => item.name);
        this.departments = departments.filter(department => department.enabled).map(department => department.name);
        this.optionsLoaded = true;
        this.loadingOptions = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingOptions = false;
        this.optionsError = true;
        this.cdr.markForCheck();
      },
    });
  }

  public open(problems:Problem[]): void {
    this.itemError = false;
    this.loadOptions();
    this.removedMediaIds.clear();
    this.addedMediaIds.clear();
    this.problems=copy(problems).map(problem=>({...problem,customFields:problem.customFields??{}}));

    if(!this.problems.length)this.add();this.visible=true;this.cdr.detectChanges()
  }

  protected close(saved=false): void {
    if(!saved) this.addedMediaIds.forEach(id=>this.mediaPreview.remove(id));

    this.visible=false;this.problems=[];
    this.newItem='';this.newItemProblemId='';
    this.removedMediaIds.clear();
    this.addedMediaIds.clear();
    this.cdr.detectChanges()
  }

  protected add(): void {
    this.problems.push({
      id:uid(),
      item:'',
      code:'',
      defect:'',
      description:'',
      department:'',
      media:[],
      customFields:{},
      treated:false
    })
  }

  protected remove(index:number): void {
    this.problems[index]?.media.forEach(media=>this.removeMediaReference(media.id));
    this.problems.splice(index,1);

    if(!this.problems.length) this.add();
  }

  protected removeMedia(problem:Problem, index:number): void {
    const media = problem.media[index];

    if(!media)return;

    this.removeMediaReference(media.id);
    problem.media.splice(index,1);
    this.cdr.detectChanges()
  }

  protected toggleItemCreator(problemId:string): void {
    this.newItemProblemId = this.newItemProblemId === problemId ? '' : problemId;this.newItem='';this.cdr.detectChanges()
  }

  protected async addCatalogItem(problem: Problem, field: NokFormField): Promise<void> {
    const value = this.newItem.trim();
    if (!value || this.addingItem || !this.optionsLoaded) return;
    this.addingItem = true;
    this.itemError = false;
    try {
      let item = this.items.find(option => option.toLocaleLowerCase() === value.toLocaleLowerCase());
      if (!item) {
        const saved = await firstValueFrom(this.api.createCatalog('ITEM', value).pipe(takeUntilDestroyed(this.destroyRef)));
        item = saved.name;
        this.items = [...this.items, item].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      }
      if (this.problems.includes(problem)) {
        setNokFieldValue(problem, field, item);
        this.newItem = '';
        this.newItemProblemId = '';
      }
    } catch {
      this.itemError = true;
    } finally {
      this.addingItem = false;
      if (!this.destroyRef.destroyed) this.cdr.markForCheck();
    }
  }

  protected async attach(problem:Problem,event:Event):Promise<void>{
    const input=event.target as HTMLInputElement;
    const files=Array.from(input.files??[]);

    for(const file of files){
      const id=uid();
      const evidence={id,name:file.name,type:file.type,size:file.size};

      if(file.type.startsWith('image/')){
        problem.media.push({...evidence,dataUrl:await this.readDataUrl(file)});
        this.mediaPreview.register(id,file);
      } else {
        problem.media.push(evidence);
        this.mediaPreview.register(id,file);
      }

      this.addedMediaIds.add(id);
    }

    input.value='';
    this.cdr.detectChanges();
  }

  private readDataUrl(file:File): Promise<string> {
    return new Promise((resolve,reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file)
    })
  }

  protected fieldValue(problem:Problem, field:NokFormField): string{
    return nokFieldValue(problem,field)
  }

  protected setFieldValue(problem:Problem, field:NokFormField, value:unknown): void {
    setNokFieldValue(problem, field, String(value??''))
  }

  protected options(field:NokFormField): string[] {
    if(field.type==='items') return this.items;
    if(field.type==='defects') return this.defects;
    if(field.type==='departments') return this.departments;

    return[]
  }

  protected valid(): boolean {
    return this.optionsLoaded && !this.addingItem && this.problems.length > 0 && this.problems.every(problem =>
      this.store.state().nokFields.every(field => !field.required || !!this.fieldValue(problem, field).trim())
    )
  }

  protected save(): void {
    if(!this.valid()) return;
    this.removedMediaIds.forEach(id => this.mediaPreview.remove(id)); this.saved.emit(copy(this.problems)); this.close(true);
  }

  private removeMediaReference(id:string): void {
    this.addedMediaIds.delete(id) ? this.mediaPreview.remove(id) : this.removedMediaIds.add(id);
  }
}

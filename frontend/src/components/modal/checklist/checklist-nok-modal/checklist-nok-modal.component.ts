import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective } from '@coreui/angular';
import { ModalBackNavigationDirective } from '../../../../app/directive/modal-back-navigation.directive';
import { NokFormField, Problem } from '../../../../app/interface/checklist.interface';
import { checklistCopy as copy, checklistId as uid } from '../../../../app/shared/checklist-factory';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { nokFieldValue, setNokFieldValue } from '../../../../app/shared/checklist-rules';
import { ChecklistMediaPreviewService } from '../../../../app/services/checklist-media-preview.service';
import { PostitionService } from '../../../../app/services/position.service';
import { Position } from '../../../../app/interface/position.interface';

@Component({ selector: 'app-checklist-nok-modal', imports: [FormsModule, ButtonCloseDirective, ButtonDirective, FormControlDirective, FormSelectDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, TooltipDirective, ModalBackNavigationDirective, ChecklistIconComponent], templateUrl: './checklist-nok-modal.component.html', styleUrl: './checklist-nok-modal.component.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class ChecklistNokModalComponent implements OnInit {
  @Output() saved = new EventEmitter<Problem[]>(); protected visible=false; protected problems:Problem[]=[]; protected newItem=''; protected newItemProblemId=''; protected departments:string[]=[]; private removedMediaIds=new Set<string>(); private addedMediaIds=new Set<string>();
  constructor(protected store:ChecklistPreviewService,private cdr:ChangeDetectorRef,private mediaPreview:ChecklistMediaPreviewService,private positions:PostitionService){}
  ngOnInit():void{this.positions.findAll().subscribe({next:(departments:Position[])=>{this.departments=departments.filter(department=>department.activated).map(department=>department.name).sort((a,b)=>a.localeCompare(b));this.cdr.detectChanges()},error:()=>{this.departments=[];this.cdr.detectChanges()}})}
  public open(problems:Problem[]):void{this.removedMediaIds.clear();this.addedMediaIds.clear();this.problems=copy(problems).map(problem=>({...problem,customFields:problem.customFields??{}}));if(!this.problems.length)this.add();this.visible=true;this.cdr.detectChanges()}
  protected close(saved=false):void{if(!saved)this.addedMediaIds.forEach(id=>this.mediaPreview.remove(id));this.visible=false;this.problems=[];this.newItem='';this.newItemProblemId='';this.removedMediaIds.clear();this.addedMediaIds.clear();this.cdr.detectChanges()}
  protected add():void{this.problems.push({id:uid(),item:'',code:'',defect:'',description:'',department:'',media:[],customFields:{},treated:false})}
  protected remove(index:number):void{this.problems[index]?.media.forEach(media=>this.removeMediaReference(media.id));this.problems.splice(index,1);if(!this.problems.length)this.add()}
  protected removeMedia(problem:Problem,index:number):void{const media=problem.media[index];if(!media)return;this.removeMediaReference(media.id);problem.media.splice(index,1);this.cdr.detectChanges()}
  protected toggleItemCreator(problemId:string):void{this.newItemProblemId=this.newItemProblemId===problemId?'':problemId;this.newItem='';this.cdr.detectChanges()}
  protected addCatalogItem(problem:Problem,field:NokFormField):void{const value=this.newItem.trim();if(!value)return;const normalized=value.charAt(0).toLocaleUpperCase()+value.slice(1).toLocaleLowerCase();const data=copy(this.store.state());const existing=data.items.find(item=>item.toLocaleLowerCase()===value.toLocaleLowerCase());const itemValue=existing??normalized;if(!existing){data.items.push(itemValue);data.items.sort((a,b)=>a.localeCompare(b));this.store.commit(data)}setNokFieldValue(problem,field,itemValue);this.newItem='';this.newItemProblemId='';this.cdr.detectChanges()}
  protected async attach(problem:Problem,event:Event):Promise<void>{
    const input=event.target as HTMLInputElement;
    const files=Array.from(input.files??[]);
    for(const file of files){
      const id=uid();
      const evidence={id,name:file.name,type:file.type,size:file.size};
      if(file.type.startsWith('image/')){
        problem.media.push({...evidence,dataUrl:await this.readDataUrl(file)});
        this.mediaPreview.register(id,file);
      }else{
        problem.media.push(evidence);
        this.mediaPreview.register(id,file);
      }
      this.addedMediaIds.add(id);
    }
    input.value='';
    this.cdr.detectChanges();
  }
  private readDataUrl(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
  protected fieldValue(problem:Problem,field:NokFormField):string{return nokFieldValue(problem,field)}
  protected setFieldValue(problem:Problem,field:NokFormField,value:unknown):void{setNokFieldValue(problem,field,String(value??''))}
  protected options(field:NokFormField):string[]{if(field.type==='items')return this.store.state().items;if(field.type==='defects')return this.store.state().defects;if(field.type==='departments')return this.departments;return[]}
  protected valid():boolean{return this.problems.length>0&&this.problems.every(problem=>this.store.state().nokFields.every(field=>!field.required||!!this.fieldValue(problem,field).trim()))}
  protected save():void{if(!this.valid())return;this.removedMediaIds.forEach(id=>this.mediaPreview.remove(id));this.saved.emit(copy(this.problems));this.close(true)}
  private removeMediaReference(id:string):void{if(this.addedMediaIds.delete(id))this.mediaPreview.remove(id);else this.removedMediaIds.add(id)}
}

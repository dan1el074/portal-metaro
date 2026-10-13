import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective, CardBodyComponent, CardComponent, FormControlDirective } from '@coreui/angular';
import { MultiSelectComponent, MultiSelectOptionComponent } from '@coreui/angular-pro';
import { Checklist, Flow, Problem } from '../../../../app/interface/checklist.interface';
import { ChecklistFieldComponent } from '../checklist-field/checklist-field.component';
import { ChecklistIconComponent } from '../../../icons/checklist-icon/checklist-icon.component';
import { ChecklistNokModalComponent } from '../../../modal/checklist/checklist-nok-modal/checklist-nok-modal.component';
import { PositionMin } from '../../../../app/interface/position.interface';
import { PostitionService } from '../../../../app/services/position.service';
import { ChecklistPreviewService } from '../../../../app/services/checklist-preview.service';
import { ChecklistClientHistoryComponent } from '../../../offcanvas/checklist-client-history/checklist-client-history.component';

@Component({ selector:'app-checklist-record-form',imports:[CommonModule,FormsModule,ButtonDirective,CardComponent,CardBodyComponent,FormControlDirective,MultiSelectComponent,MultiSelectOptionComponent,ChecklistFieldComponent,ChecklistIconComponent,ChecklistNokModalComponent,ChecklistClientHistoryComponent],templateUrl:'./checklist-record-form.component.html',styleUrl:'./checklist-record-form.component.scss',changeDetection:ChangeDetectionStrategy.OnPush })
export class ChecklistRecordFormComponent implements OnInit{
 @Input({required:true})record!:Checklist;@Input({required:true})flow!:Flow;@Output()changed=new EventEmitter<void>();@Output()saveRecord=new EventEmitter<boolean>();@Output()cancel=new EventEmitter<void>();@ViewChild(ChecklistNokModalComponent)protected nokModal!:ChecklistNokModalComponent;protected departments:PositionMin[]=[];protected nokQuestion='';
 constructor(private positionService:PostitionService,private cdr:ChangeDetectorRef,protected store:ChecklistPreviewService){}
 public ngOnInit():void{this.positionService.list().subscribe({next:(departments:PositionMin[])=>{this.departments=departments;this.cdr.detectChanges()},error:()=>{this.cdr.detectChanges()}})}
 protected get snapshot(){return this.flow.plan.find(item=>item.template.id===this.record.templateId)!}
 protected answer(questionId:string,value:string):void{const answer=this.record.answers[questionId];answer.value=value;if(value==='NOK'){this.nokQuestion=questionId;this.nokModal.open(answer.problems)}else answer.problems=[];this.changed.emit()}
 protected saveProblems(problems:Problem[]):void{this.record.answers[this.nokQuestion].problems=problems;this.changed.emit()}
 protected setDepartments(value:string[]):void{this.record.departments=value;this.changed.emit()}
}

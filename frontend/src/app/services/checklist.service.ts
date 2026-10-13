import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category, Checklist, Comment, Equipment, Flow, Template } from '../interface/checklist.interface';
import { PendingIssues } from '../interface/user.interface';

export interface ChecklistPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

export interface ChecklistCatalogEntry {
  id: number;
  type: 'ITEM' | 'DEFECT';
  name: string;
  active: boolean;
}

export interface ChecklistRecordCreate {
  templateId: string;
  predecessorRecordId?: string;
  serial?: string;
  order?: string;
  clientId?: string;
  client?: string;
  item?: string;
  seller?: string;
}

export interface ChecklistErpOrder {
  number: number;
  client: string;
  cnpj: string;
  salesperson: string;
  items: Array<{ code: string; description: string; quantity: number }>;
}

export interface ChecklistVideoUpload {
  evidence: { id: string; name: string; type: string; size: number; publicUrl: string };
  upload: {
    id: number;
    bunnyVideoId: string;
    libraryId: string;
    uploadEndpoint: string;
    authorizationSignature: string;
    authorizationExpire: number;
    viewUrl: string;
  };
}

export interface ChecklistOperator {
  id: number;
  name: string;
  activated: boolean;
}

export interface ChecklistLinkedStepFlow {
  id: number;
  order: string;
  status: string;
  currentStep: string | null;
}

@Injectable({ providedIn: 'root' })
export class ChecklistService {
  private readonly api = environment.apiUrl + '/api/checklist';

  constructor(private readonly http: HttpClient) {}

  listCategories(): Observable<Category[]> { return this.http.get<Category[]>(`${this.api}/categories`); }
  createCategory(value: Category): Observable<Category> { return this.http.post<Category>(`${this.api}/categories`, this.withoutId(value)); }
  updateCategory(value: Category): Observable<Category> { return this.http.put<Category>(`${this.api}/categories/${value.id}`, value); }
  deleteCategory(id: string): Observable<void> { return this.http.delete<void>(`${this.api}/categories/${id}`); }
  myAccess(): Observable<string[]> { return this.http.get<string[]>(`${this.api}/access/me`); }
  listOperators(): Observable<ChecklistOperator[]> { return this.http.get<ChecklistOperator[]>(`${this.api}/access/operators`); }
  updateAccess(categoryId: string, operatorIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.api}/access`, { categoryId, userIds: operatorIds });
  }

  listEquipment(): Observable<Equipment[]> { return this.http.get<Equipment[]>(`${this.api}/equipment`); }
  createEquipment(value: Equipment): Observable<Equipment> { return this.http.post<Equipment>(`${this.api}/equipment`, this.withoutId(value)); }
  updateEquipment(value: Equipment): Observable<Equipment> { return this.http.put<Equipment>(`${this.api}/equipment/${value.id}`, value); }
  deleteEquipment(id: string): Observable<void> { return this.http.delete<void>(`${this.api}/equipment/${id}`); }

  listTemplates(): Observable<Template[]> { return this.http.get<Template[]>(`${this.api}/templates`); }
  createTemplate(value: Template): Observable<Template> { return this.http.post<Template>(`${this.api}/templates`, this.withoutId(this.templatePayload(value))); }
  updateTemplate(value: Template): Observable<Template> { return this.http.put<Template>(`${this.api}/templates/${value.id}`, this.templatePayload(value)); }
  deleteTemplate(id: string): Observable<void> { return this.http.delete<void>(`${this.api}/templates/${id}`); }

  listCatalog(type: 'ITEM' | 'DEFECT'): Observable<ChecklistCatalogEntry[]> {
    return this.http.get<ChecklistCatalogEntry[]>(`${this.api}/catalog/${type}`);
  }
  createCatalog(type: 'ITEM' | 'DEFECT', name: string): Observable<ChecklistCatalogEntry> {
    return this.http.post<ChecklistCatalogEntry>(`${this.api}/catalog`, { type, name, active: true });
  }
  updateCatalog(entry: ChecklistCatalogEntry): Observable<ChecklistCatalogEntry> {
    return this.http.put<ChecklistCatalogEntry>(`${this.api}/catalog/${entry.id}`, entry);
  }

  listRecords(size = 2000): Observable<ChecklistPage<Checklist>> {
    return this.http.get<ChecklistPage<Checklist>>(`${this.api}/records`, { params: new HttpParams().set('size', size) });
  }
  listFlows(): Observable<Flow[]> { return this.http.get<Flow[]>(`${this.api}/records/flows`); }
  findErpOrder(orderNumber: string): Observable<ChecklistErpOrder> {
    return this.http.get<ChecklistErpOrder>(`${this.api}/erp/orders/${encodeURIComponent(orderNumber)}`);
  }
  getRecord(id: string): Observable<Checklist> { return this.http.get<Checklist>(`${this.api}/records/${id}`); }
  getFlow(recordId: string): Observable<Flow> { return this.http.get<Flow>(`${this.api}/records/${recordId}/flow`); }
  createRecord(value: ChecklistRecordCreate): Observable<Checklist> { return this.http.post<Checklist>(`${this.api}/records`, value); }
  saveRecord(value: Checklist, finish: boolean): Observable<Checklist> {
    return this.http.put<Checklist>(`${this.api}/records/${value.id}${finish ? '/finish' : ''}`, value);
  }
  claim(id: string): Observable<Checklist> { return this.http.put<Checklist>(`${this.api}/records/${id}/claim`, null); }
  delegate(id: string, userId: number): Observable<Checklist> {
    return this.http.put<Checklist>(`${this.api}/records/${id}/delegate/${userId}`, null);
  }
  treat(id: string, problemId: string, justification: string): Observable<Checklist> {
    return this.http.put<Checklist>(`${this.api}/records/${id}/treatment`, { problemId, justification });
  }
  reopen(id: string, reason: string): Observable<Checklist> {
    return this.http.put<Checklist>(`${this.api}/records/${id}/reopen`, { reason });
  }
  cancel(id: string, reason: string): Observable<void> {
    return this.http.put<void>(`${this.api}/records/${id}/cancel`, { reason });
  }
  deleteDraft(id: string): Observable<void> { return this.http.delete<void>(`${this.api}/records/${id}`); }
  updateOrder(id: string, order: string, item: string): Observable<Flow> {
    return this.http.put<Flow>(`${this.api}/records/${id}/order`, { order, item });
  }
  updateSerial(id: string, serial: string): Observable<Flow> {
    return this.http.put<Flow>(`${this.api}/records/${id}/serial`, { serial });
  }
  addComment(id: string, text: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.api}/records/${id}/comments`, { text });
  }
  updateComment(recordId: string, commentId: string, text: string): Observable<Comment> {
    return this.http.put<Comment>(`${this.api}/records/${recordId}/comments/${commentId}`, { text });
  }
  deleteComment(recordId: string, commentId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/records/${recordId}/comments/${commentId}`);
  }

  uploadImages(recordId: string, problemId: string, files: File[]): Observable<Array<{ id: string; name: string; type: string; size: number; publicUrl: string }>> {
    const data = new FormData();
    data.append('problemId', problemId);
    files.forEach((file) => data.append('images', file));
    return this.http.post<Array<{ id: string; name: string; type: string; size: number; publicUrl: string }>>(`${this.api}/records/${recordId}/evidence/images`, data);
  }
  createVideo(recordId: string, problemId: string, name: string): Observable<ChecklistVideoUpload> {
    return this.http.post<ChecklistVideoUpload>(`${this.api}/records/${recordId}/evidence/videos`, { problemId, name });
  }
  completeVideo(recordId: string, evidenceId: string): Observable<unknown> {
    return this.http.put(`${this.api}/records/${recordId}/evidence/${evidenceId}/complete`, null);
  }
  deleteEvidence(recordId: string, evidenceId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/records/${recordId}/evidence/${evidenceId}`);
  }

  listStepRequirements(): Observable<Array<{ stepType: string; categoryId: string }>> {
    return this.http.get<Array<{ stepType: string; categoryId: string }>>(`${this.api}/step-flow/requirements`);
  }
  saveStepRequirement(stepType: string, categoryId: string): Observable<{ stepType: string; categoryId: string }> {
    return this.http.put<{ stepType: string; categoryId: string }>(`${this.api}/step-flow/requirements`, { stepType, categoryId });
  }
  deleteStepRequirement(stepType: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/step-flow/requirements/${stepType}`);
  }
  listStepFlowAlerts(): Observable<PendingIssues[]> {
    return this.http.get<PendingIssues[]>(`${this.api}/step-flow/alerts`);
  }
  listLinkedStepFlows(flowId: string): Observable<ChecklistLinkedStepFlow[]> {
    return this.http.get<ChecklistLinkedStepFlow[]>(`${this.api}/step-flow/flows/${flowId}/orders`);
  }

  private templatePayload(value: Template): object {
    return { ...value, equipmentId: value.equipmentId || null, predecessorId: value.predecessorId || null };
  }

  private withoutId<T extends object>(value: T): Omit<T, 'id'> {
    const { id, ...payload } = value as T & { id?: unknown };
    return payload;
  }
}

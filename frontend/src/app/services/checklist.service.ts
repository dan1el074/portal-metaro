import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, firstValueFrom, from, switchMap, map } from 'rxjs';
import { normalizeChecklistIntegration } from '../shared/checklist-rules';
import { environment } from '../../environments/environment';
import { Category, Checklist, ChecklistTableRow, Comment, Equipment, Flow, Status, Template } from '../interface/checklist.interface';
import { PendingIssues } from '../interface/user.interface';

export interface ChecklistCreationOption {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  integration: Category['integration'];
  erp: boolean;
  serial: boolean;
  standalone: boolean;
  hasPredecessor: boolean;
}

export interface ChecklistPredecessor {
  id: string;
  serial: string | null;
  title: string;
  finished: string;
}

export interface ChecklistRecordContext {
  record: Checklist;
  flow: Flow;
  editable: boolean;
  clientNokHistory: boolean;
  blocked: boolean;
  previousId: string | null;
  nextId: string | null;
  steps: Array<{
    templateId: string;
    label: string;
    title: string;
    recordId: string | null;
    status: Status | null;
    skipped: boolean;
  }>;
}

export interface ChecklistPage<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
}

export type ChecklistCategoryTab = Pick<Category, 'id' | 'name'>;
export type ChecklistCategorySummary = Pick<Category, 'id' | 'name' | 'integration' | 'active'>;
export type ChecklistCategoryHistory = Pick<Category, 'id' | 'name' | 'integration' | 'clientNokHistory'>;
export type ChecklistCategoryAccess = Pick<Category, 'id' | 'name' | 'operators'>;
export interface ChecklistAccessChange {
  categoryId: string;
  userId: number;
  allowed: boolean;
}
export interface ChecklistCategoryModelOption extends Pick<Category, 'id' | 'name' | 'integration' | 'erp' | 're' | 'ref' | 'media'> {
  fieldIds: string[];
}
export type ChecklistTemplateOption = Pick<Template, 'id' | 'name' | 'categoryId' | 'equipmentId' | 'predecessorId'>;
export interface ChecklistTemplateSummary extends ChecklistTemplateOption {
  equipment: string | null;
  version: number;
  used: boolean;
}

export interface ChecklistHeader {
  categories: ChecklistCategoryTab[];
  headerCount: Array<{ categories: number; models: number; equipment: number }>;
}

export interface ChecklistDepartment { id: number; name: string; enabled: boolean; }

export interface ChecklistMemorando {
  id: number;
  number: number | null;
  title: string;
  createAt: string | null;
  status: 'CREATED' | 'PUBLISH' | 'APPROVED' | 'CANCELED';
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
  readyStock?: boolean;
  confirmWithoutSerial?: boolean;
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
  linked?: boolean;
  id: number;
  order: string;
  status: string;
  currentStep: string | null;
}

@Injectable({ providedIn: 'root' })
export class ChecklistService {
  private readonly api = environment.apiUrl + '/api/checklist';

  constructor(private readonly http: HttpClient) {}

  header(): Observable<ChecklistHeader> {
    return this.http.get<ChecklistHeader>(`${this.api}/header`).pipe(map(header => ({
      ...header, categories: header.categories.map(category => ({ ...category, id: String(category.id) })),
    })));
  }

  listCategorySummaries(): Observable<ChecklistCategorySummary[]> {
    return this.http.get<ChecklistCategorySummary[]>(`${this.api}/categories/summary`).pipe(map(categories =>
      categories.map(category => ({ ...category, id: String(category.id), integration: normalizeChecklistIntegration(category.integration) })),
    ));
  }

  listCategoryModelOptions(): Observable<ChecklistCategoryModelOption[]> {
    return this.http.get<ChecklistCategoryModelOption[]>(`${this.api}/categories/model-options`).pipe(map(categories =>
      categories.map(category => ({ ...category, id: String(category.id), integration: normalizeChecklistIntegration(category.integration) })),
    ));
  }

  getCategory(id: string): Observable<Category> {
    return this.http.get<Category>(`${this.api}/categories/${id}`).pipe(map(category => ({
      ...category, id: String(category.id), integration: normalizeChecklistIntegration(category.integration),
    })));
  }

  updateCategoryStatus(id: string, active: boolean, reason: string): Observable<void> {
    return this.http.patch<void>(`${this.api}/categories/${id}/status`, { active, reason });
  }

  listCategoryHistorySettings(): Observable<ChecklistCategoryHistory[]> {
    return this.http.get<ChecklistCategoryHistory[]>(`${this.api}/categories/history-settings`).pipe(map(categories =>
      categories.map(category => ({ ...category, id: String(category.id), integration: normalizeChecklistIntegration(category.integration) })),
    ));
  }

  updateCategoryHistory(settings: Record<string, boolean>): Observable<void> {
    return this.http.patch<void>(`${this.api}/categories/history-settings`, settings);
  }

  listCategoryAccess(): Observable<ChecklistCategoryAccess[]> {
    return this.http.get<ChecklistCategoryAccess[]>(`${this.api}/access/categories`).pipe(map(categories =>
      categories.map(category => ({ ...category, id: String(category.id) })),
    ));
  }

  listCategories(): Observable<Category[]> { return this.http.get<Category[]>(`${this.api}/categories`); }
  createCategory(value: Category): Observable<Category> { return from(this.categoryPayload(value)).pipe(switchMap(dto => this.http.post<Category>(`${this.api}/categories`, this.withoutId(dto)))); }
  updateCategory(value: Category): Observable<Category> { return from(this.categoryPayload(value)).pipe(switchMap(dto => this.http.put<Category>(`${this.api}/categories/${value.id}`, dto))); }
  deleteCategory(id: string): Observable<void> { return this.http.delete<void>(`${this.api}/categories/${id}`); }
  private nextNestedId = 0n;
  private blockEnd = 0n;
  private reserving?: Promise<void>;

  async nestedId(): Promise<string> {
    while (this.nextNestedId === this.blockEnd) {
      this.reserving ??= firstValueFrom(this.http.post(`${this.api}/records/id-block`, {}, { responseType: 'text' }))
        .then(first => { this.nextNestedId = BigInt(first); this.blockEnd = this.nextNestedId + 256n; })
        .finally(() => { this.reserving = undefined; });
      await this.reserving;
    }
    return String(this.nextNestedId++);
  }

  newContext(templateId: string, previous: string): Observable<Flow> {
    return this.http.get<Flow>(`${this.api}/records/new-context`, { params: previous ? { templateId, previous } : { templateId } });
  }
  listOperators(): Observable<ChecklistOperator[]> { return this.http.get<ChecklistOperator[]>(`${this.api}/access/operators`); }
  updateAccess(categoryId: string, operatorIds: number[]): Observable<void> {
    return this.http.put<void>(`${this.api}/access`, { categoryId, userIds: operatorIds });
  }

  updateAccessBatch(changes: ChecklistAccessChange[]): Observable<void> {
    return this.http.patch<void>(`${this.api}/access`, changes);
  }

  listEquipment(): Observable<Equipment[]> { return this.http.get<Equipment[]>(`${this.api}/equipment`); }
  createEquipment(value: Equipment): Observable<Equipment> { return this.http.post<Equipment>(`${this.api}/equipment`, this.withoutId(value)); }
  updateEquipment(value: Equipment): Observable<Equipment> { return this.http.put<Equipment>(`${this.api}/equipment/${value.id}`, value); }
  deleteEquipment(id: string): Observable<void> { return this.http.delete<void>(`${this.api}/equipment/${id}`); }

  listTemplateSummaries(): Observable<ChecklistTemplateSummary[]> {
    return this.http.get<ChecklistTemplateSummary[]>(`${this.api}/templates/summary`).pipe(map(templates =>
      templates.map(template => ({
        ...template, id: String(template.id), categoryId: String(template.categoryId),
        equipmentId: template.equipmentId == null ? '' : String(template.equipmentId),
        predecessorId: template.predecessorId == null ? '' : String(template.predecessorId),
      })),
    ));
  }

  getTemplate(id: string): Observable<Template> { return this.http.get<Template>(`${this.api}/templates/${id}`); }

  listTemplates(): Observable<Template[]> { return this.http.get<Template[]>(`${this.api}/templates`); }
  createTemplate(value: Template): Observable<Template> { return from(this.templatePayload(value, true)).pipe(switchMap(dto => this.http.post<Template>(`${this.api}/templates`, this.withoutId(dto)))); }
  updateTemplate(value: Template): Observable<Template> { return from(this.templatePayload(value, false)).pipe(switchMap(dto => this.http.put<Template>(`${this.api}/templates/${value.id}`, dto))); }
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

  listRecordRows(query: { page: number; size: number; categoryId?: string; search?: string; status?: string; sort?: string; consultation?: boolean; actionable?: boolean }): Observable<ChecklistPage<ChecklistTableRow>> {
    let params = new HttpParams();
    Object.entries(query).forEach(([key, value]) => { if (value !== undefined && value !== '') params = params.set(key, value); });
    return this.http.get<ChecklistPage<ChecklistTableRow>>(`${this.api}/records/table`, { params });
  }
  recordCounts(consultation: boolean): Observable<Record<string, number>> {
    return this.http.get<Record<string, number>>(`${this.api}/records/counts`, { params: new HttpParams().set('consultation', consultation) });
  }
  listDepartments(): Observable<ChecklistDepartment[]> { return this.http.get<ChecklistDepartment[]>(`${this.api}/departments`); }
  saveDepartments(ids: number[]): Observable<ChecklistDepartment[]> { return this.http.put<ChecklistDepartment[]>(`${this.api}/departments`, ids); }

  listRecords(size = 2000): Observable<ChecklistPage<Checklist>> {
    return this.http.get<ChecklistPage<Checklist>>(`${this.api}/records`, { params: new HttpParams().set('size', size) });
  }
  listFlows(): Observable<Flow[]> { return this.http.get<Flow[]>(`${this.api}/records/flows`); }
  findErpOrder(orderNumber: string): Observable<ChecklistErpOrder> {
    return this.http.get<ChecklistErpOrder>(`${this.api}/erp/orders/${encodeURIComponent(orderNumber)}`);
  }
  creationOptions(): Observable<ChecklistCreationOption[]> {
    return this.http.get<ChecklistCreationOption[]>(`${this.api}/records/creation-options`).pipe(
      map(options => options.map(option => ({ ...option, id: String(option.id), categoryId: String(option.categoryId),
        integration: normalizeChecklistIntegration(option.integration) }))),
    );
  }

  eligiblePredecessors(templateId: string, page: number) {
    return this.http.get<{ content: ChecklistPredecessor[]; last: boolean }>(
      `${this.api}/records/eligible-predecessors`, { params: { templateId, page } },
    );
  }

  availableSerials(order: string, readyStock: boolean, item = ''): Observable<Array<{ serial: string; description: string }>> {
    return this.http.get<Array<{ serial: string; description: string }>>(`${this.api}/records/available-serials`, {
      params: new HttpParams().set('order', order).set('readyStock', readyStock).set('item', readyStock ? '' : item),
    });
  }
  getRecordContext(id: string, editing: boolean): Observable<ChecklistRecordContext> {
    return this.http.get<ChecklistRecordContext>(`${this.api}/records/${id}/context`, {
      params: new HttpParams().set('editing', editing),
    });
  }

  getRecord(id: string): Observable<Checklist> { return this.http.get<Checklist>(`${this.api}/records/${id}`); }
  getFlow(recordId: string): Observable<Flow> { return this.http.get<Flow>(`${this.api}/records/${recordId}/flow`); }
  createRecord(value: ChecklistRecordCreate): Observable<Checklist> { return this.http.post<Checklist>(`${this.api}/records`, value); }
  saveRecord(value: Checklist, finish: boolean, confirmOpenMemorandos = false): Observable<Checklist> {
    return this.http.put<Checklist>(`${this.api}/records/${value.id}${finish ? '/finish' : ''}`, { ...value, confirmOpenMemorandos: finish && confirmOpenMemorandos });
  }
  claim(id: string): Observable<Checklist> {
    return this.http.put<Checklist>(`${this.api}/records/${id}/claim`, null, { params: { editing: true } });
  }
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
  skip(id: string, reason: string): Observable<void> {
    return this.http.put<void>(`${this.api}/records/${id}/skip`, { reason });
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

  listRelatedMemorandos(recordId: string): Observable<ChecklistMemorando[]> {
    return this.http.get<ChecklistMemorando[]>(`${this.api}/records/${recordId}/memorandos`);
  }

  private async categoryPayload(value: Category) {
    const dto = structuredClone(value);
    for (const field of dto.fields) if (Number(field.id) < 0) field.id = await this.nestedId();
    return dto;
  }

  private async templatePayload(value: Template, creating: boolean) {
    const dto = structuredClone(value);
    const replacements = new Map<string, string>();
    for (const section of dto.sections) {
      const nodes = [section, ...section.questions.flatMap(question => [question, ...question.fields])];
      for (const node of nodes) {
        if (creating || Number(node.id) < 0) {
          const id = await this.nestedId();
          replacements.set(String(node.id), id);
          node.id = id;
        }
      }
    }
    dto.title = dto.title.replace(/\{([^}]+)\}/g, (token, id) => replacements.has(id) ? `{${replacements.get(id)}}` : token);
    return { ...dto, equipmentId: dto.equipmentId || null, predecessorId: dto.predecessorId || null };
  }

  private withoutId<T extends object>(value: T): Omit<T, 'id'> {
    const { id, ...payload } = value as T & { id?: unknown };
    return payload;
  }
}

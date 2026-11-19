import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { UserService } from './user.service';
import { Checklist, ChecklistState, Flow, Status, Template } from '../interface/checklist.interface';
import { CHECKLIST_BODY_EVIDENCE_ID, checklistCopy as copy, checklistId as uid, checklistNow as now, defaultChecklistNokFields } from '../shared/checklist-factory';
import { blockingPredecessor, migrateTitleFormula, normalizeChecklistIntegration, recordTitle, validateRecord, validateTemplate } from '../shared/checklist-rules';
import { ChecklistCatalogEntry, ChecklistRecordContext, ChecklistRecordCreate, ChecklistService } from './checklist.service';
import { ChecklistMediaPreviewService } from './checklist-media-preview.service';
import { Upload } from 'tus-js-client';

@Injectable({ providedIn: 'root' })
export class ChecklistPreviewService {
  private readonly users = inject(UserService);
  private readonly api = inject(ChecklistService);
  private readonly mediaPreview = inject(ChecklistMediaPreviewService);
  readonly state = signal<ChecklistState>(this.emptyState());
  readonly warning = signal('');
  readonly uploadState = signal<{ fileName: string; kind: 'image' | 'video'; progress: number; current: number; total: number } | null>(null);
  private loading?: Promise<void>;
  private catalogEntries: ChecklistCatalogEntry[] = [];
  private contextLoadVersion = 0;

  get user() { return this.users.getCurrentUser()! }
  get admin() { return this.user.roles.some((r) => ['ROLE_ADMIN', 'ROLE_CHECKLIST_ADMIN'].includes(r.authority)) }
  get operator() { return (this.admin || this.user.roles.some((r) => r.authority === 'ROLE_CHECKLIST_OPERATOR')) }

  private configurationOnly = false;

  load(force = false, configurationOnly = false): Promise<void> {
    if (this.loading && !force) {
      if (this.configurationOnly === configurationOnly) return this.loading;
      return this.loading.then(() => this.load(false, configurationOnly));
    }
    this.configurationOnly = configurationOnly;
    this.loading = this.fetchState(configurationOnly).finally(() => this.loading = undefined);
    return this.loading;
  }

  commit(data: ChecklistState): Promise<boolean> {
    const previous = this.state();
    this.state.set(copy(data));
    return this.persistConfiguration(previous, data);
  }

  private async fetchState(configurationOnly = false): Promise<void> {
    try {
      const result = await firstValueFrom(forkJoin({
        categories: this.api.listCategories(),
        equipment: this.api.listEquipment(),
        templates: this.api.listTemplates(),
        records: configurationOnly ? of({ content: [] as Checklist[] }) : this.api.listRecords(),
        flows: configurationOnly ? of([] as Flow[]) : this.api.listFlows(),
        items: this.api.listCatalog('ITEM'),
        defects: this.api.listCatalog('DEFECT'),
      }));
      this.catalogEntries = [...result.items, ...result.defects];
      const records = result.records.content.map((record) => this.normalizeRecord(record));
      const flows = result.flows.map((flow) => this.normalizeFlow(flow));
      result.categories.forEach((category) => {
        category.id = String(category.id);
        category.integration = normalizeChecklistIntegration(category.integration);
        category.media ??= false;
      });
      result.categories.sort((first, second) => Number(first.id) - Number(second.id));
      result.equipment.forEach((equipment) => equipment.id = String(equipment.id));
      result.templates.forEach((template) => this.normalizeTemplate(template));
      this.state.set({
        schema: 1,
        categories: result.categories,
        equipment: result.equipment,
        templates: result.templates,
        flows,
        records,
        items: result.items.filter((entry) => entry.active).map((entry) => entry.name),
        defects: result.defects.filter((entry) => entry.active).map((entry) => entry.name),
        nokFields: defaultChecklistNokFields(),
      });
      this.warning.set('');
    } catch {
      this.warning.set('Não foi possível carregar os checklists do servidor. Tente novamente.');
      throw new Error(this.warning());
    }
  }

  private emptyState(): ChecklistState {
    return { schema: 1, categories: [], equipment: [], templates: [], flows: [], records: [], items: [], defects: [], nokFields: defaultChecklistNokFields() };
  }

  private readonly statuses: Record<string, Status> = { DRAFT: 'Rascunho', IN_PROGRESS: 'Em andamento', PENDING: 'Pendente', FINISHED: 'Finalizado', JUSTIFIED: 'Justificado', CANCELLED: 'Cancelado' };

  private normalizeRecord(record: Checklist): Checklist {
    const normalizeProblems = (answers: Checklist['answers']) => {
      for (const answer of Object.values(answers ?? {})) {
        for (const problem of answer.problems ?? []) problem.id = String(problem.id);
      }
    };
    normalizeProblems(record.answers);
    for (const revision of record.revisions ?? []) normalizeProblems(revision.record.answers);
    record.id = String(record.id);
    record.flowId = String(record.flowId);
    record.templateId = String(record.templateId);
    record.status = this.statuses[record.status] ?? record.status;
    record.comments ??= [];
    record.logs ??= [];
    record.revisions ??= [];
    record.fields ??= {};
    record.media ??= [];
    record.comments.forEach(comment => {
      comment.id = String(comment.id);
      if (comment.problemId != null) comment.problemId = String(comment.problemId);
    });
    const knownProblems = [record, ...record.revisions.map(revision => revision.record)].flatMap(item =>
      Object.values(item.answers ?? {}).flatMap(answer => answer.problems ?? []));
    record.logs.forEach((log) => {
      const problem = knownProblems.find(item => log.details === `Problema ${item.id} tratado.`
        || log.details === `Tratamento revertido para o problema ${item.id}.`);
      if (problem) log.details = `Não conformidade: ${problem.item} — ${problem.code || problem.defect}.`;
      log.id = String(log.id);
      log.displayDetails = ['SERIAL_PLATE_UPDATED', 'ORDER_UPDATED', 'SERIAL_UPDATED', 'REOPENED', 'CANCELLED',
        'DELEGATED', 'TREATED', 'PROBLEM_TREATED', 'TREATMENT_REVERSED', 'CATEGORY_SKIPPED', 'CHECKLIST_SKIPPED', 'SERIAL_WAIVED', 'FINISHED_WITH_OPEN_MEMORANDOS']
        .includes(log.action) ? log.details : undefined;
      if (log.action === 'SERIAL_PLATE_UPDATED') {
        const orderChange = log.details?.match(/(?:^|[.;]\s*)Pedido: ([^;]+) → ([^;]+)/);
        log.action = orderChange
          ? `Pedido atualizado pelo PCP: ${orderChange[1].trim()} → ${orderChange[2].trim()}.`
          : this.auditAction(log.action);
        log.displayDetails = undefined;
      } else {
        log.action = this.auditAction(log.action);
      }
    });
    Object.values(record.answers ?? {}).forEach((answer) => {
      answer.description ??= '';
      answer.fields ??= {};
      answer.problems ??= [];
      answer.problems.forEach((problem) => problem.customFields ??= {});
    });
    record.revisions.forEach((revision) => {
      const snapshot = revision.record as Checklist;
      snapshot.id = String(snapshot.id);
      snapshot.flowId = String(snapshot.flowId);
      snapshot.templateId = String(snapshot.templateId);
      if (this.statuses[snapshot.status]) snapshot.status = this.statuses[snapshot.status];
      snapshot.media ??= [];
    });
    return record;
  }

  private normalizeFlow(flow: Flow): Flow {
    flow.id = flow.id == null ? uid() : String(flow.id);
    flow.serial ??= '';
    flow.order ??= '';
    flow.clientId ??= '';
    flow.client ??= '';
    flow.item ??= '';
    flow.seller ??= '';
    flow.skipped ??= {};
    flow.plan.forEach((snapshot) => {
      this.normalizeTemplate(snapshot.template);
      snapshot.category.fields?.forEach(field => field.id = String(field.id));
      snapshot.category.id = String(snapshot.category.id);
      snapshot.template.id = String(snapshot.template.id);
      snapshot.template.categoryId = String(snapshot.template.categoryId);
      snapshot.template.equipmentId = snapshot.template.equipmentId == null ? '' : String(snapshot.template.equipmentId);
      snapshot.template.predecessorId = snapshot.template.predecessorId == null ? '' : String(snapshot.template.predecessorId);
      snapshot.category.media = snapshot.category.integration === 'production' || !!snapshot.category.media;
    });
    return flow;
  }

  private normalizeTemplate(template: Template): Template {
    for (const section of template.sections ?? []) {
      section.id = String(section.id);
      for (const question of section.questions) {
        question.id = String(question.id);
        for (const field of question.fields) field.id = String(field.id);
      }
    }
    template.id = String(template.id);
    template.categoryId = String(template.categoryId);
    template.equipmentId = template.equipmentId == null ? '' : String(template.equipmentId);
    template.predecessorId = template.predecessorId == null ? '' : String(template.predecessorId);
    template.optionalPredecessor ??= false;
    migrateTitleFormula(template);
    return template;
  }

  private async persistConfiguration(previous: ChecklistState, current: ChecklistState): Promise<boolean> {
    const requests: Array<Promise<unknown>> = [];
    for (const category of current.categories) {
      const old = previous.categories.find((item) => item.id === category.id);
      if (!old) requests.push(firstValueFrom(this.api.createCategory(category)));
      else if (JSON.stringify(old) !== JSON.stringify(category)) {
        requests.push(firstValueFrom(this.api.updateCategory(category)));
        if (JSON.stringify(old.operators) !== JSON.stringify(category.operators)) requests.push(firstValueFrom(this.api.updateAccess(category.id, category.operators)));
      }
    }
    previous.categories.filter((old) => !current.categories.some((item) => item.id === old.id))
      .forEach((old) => requests.push(firstValueFrom(this.api.deleteCategory(old.id))));
    for (const equipment of current.equipment) {
      const old = previous.equipment.find((item) => item.id === equipment.id);
      if (!old) requests.push(firstValueFrom(this.api.createEquipment(equipment)));
      else if (JSON.stringify(old) !== JSON.stringify(equipment)) requests.push(firstValueFrom(this.api.updateEquipment(equipment)));
    }
    previous.equipment.filter((old) => !current.equipment.some((item) => item.id === old.id))
      .forEach((old) => requests.push(firstValueFrom(this.api.deleteEquipment(old.id))));
    this.persistCatalog(previous.items, current.items, 'ITEM', requests);
    this.persistCatalog(previous.defects, current.defects, 'DEFECT', requests);
    try {
      await Promise.all(requests);
      if (requests.length) await this.load(true, this.configurationOnly);
      return true;
    } catch {
      await this.load(true, this.configurationOnly).catch(() => undefined);
      this.warning.set('Uma alteração não pôde ser salva no servidor. Os dados foram recarregados.');
      return false;
    }
  }

  private persistCatalog(previous: string[], current: string[], type: 'ITEM' | 'DEFECT', requests: Array<Promise<unknown>>): void {
    current.filter((name) => !previous.includes(name)).forEach((name) => requests.push(firstValueFrom(this.api.createCatalog(type, name))));
    previous.filter((name) => !current.includes(name)).forEach((name) => {
      const entry = this.catalogEntries.find((candidate) => candidate.type === type && candidate.name === name);
      if (entry) requests.push(firstValueFrom(this.api.updateCatalog({ ...entry, active: false })));
    });
  }

  requireAdmin(): void {
    if (!this.admin) throw new Error('Ação exclusiva da administração.');
  }

  canOperate(categoryId: string): boolean {
    return (
      this.admin ||
      (this.operator &&
        !!this.state()
          .categories.find((c) => c.id === categoryId)
          ?.operators.includes(this.user.id))
    );
  }

  visible(r: Checklist): boolean {
    return (
      r.status !== 'Rascunho' ||
      this.admin ||
      (this.operator && (r.ownerId ?? r.creatorId) === this.user.id)
    );
  }

  editable(r: Checklist): boolean {
    return (
      this.visible(r) &&
      ['Rascunho', 'Em andamento'].includes(r.status) &&
      this.canOperate(this.snapshot(r).category.id) &&
      (this.admin || r.ownerId === null || r.ownerId === this.user.id)
    );
  }

  flow(r: Checklist): Flow {
    return this.state().flows.find((f) => f.id === r.flowId)!;
  }

  snapshot(r: Checklist) {
    return this.flow(r).plan.find((s) => s.template.id === r.templateId)!;
  }

  title(r: Checklist): string {
    return recordTitle(r, this.flow(r));
  }

  async updateFlowOrder(recordId: string, orderNumber: string, item: string): Promise<void> {
    this.requireAdmin();
    await firstValueFrom(this.api.updateOrder(recordId, orderNumber, item));
  }

  blocked(r: Checklist): boolean {
    return blockingPredecessor(r, this.flow(r), this.state().records);
  }

  async claim(current: Checklist): Promise<Checklist> {
    if (current.ownerId !== null) return current;
    const record = this.normalizeRecord(await firstValueFrom(this.api.claim(current.id)));
    this.state.update(data => ({ ...data, records: data.records.map(item => item.id === record.id ? record : item) }));
    return record;
  }

  async loadModelEditor(id?: string | null) {
    this.requireAdmin();
    const context = await firstValueFrom(forkJoin({
      categories: this.api.listCategoryModelOptions(),
      equipment: this.api.listEquipment(),
      templates: this.api.listTemplateSummaries(),
      model: id ? this.api.getTemplate(id) : of(null),
    }));
    return {
      ...context,
      equipment: context.equipment.map(item => ({ ...item, id: String(item.id) })),
      model: context.model ? this.normalizeTemplate(context.model) : null,
    };
  }

  async saveTemplate(model: Template, context: Awaited<ReturnType<ChecklistPreviewService['loadModelEditor']>>): Promise<void> {
    this.requireAdmin();
    const category = context.categories.find((item) => item.id === model.categoryId);
    if (category?.integration === 'production') {
      model.name = context.equipment.find((item) => item.id === model.equipmentId)?.abbreviation || '';
      model.signature = true;
    }
    const error = validateTemplate(model, context);
    if (error) throw new Error(error);
    const previous = context.model?.id === model.id;
    const saved = this.normalizeTemplate(await firstValueFrom(previous ? this.api.updateTemplate(model) : this.api.createTemplate(model)));
    this.state.update((data) => ({ ...data, templates: [...data.templates.filter((item) => item.id !== model.id), saved] }));
  }

  async newRecord(templateId: string, previous = '') {
    const flow = this.normalizeFlow(await firstValueFrom(this.api.newContext(templateId, previous)));
    return { flow, record: this.makeRecord(flow, templateId, false) };
  }
  private makeRecord(
    flow: Flow,
    templateId: string,
    automatic: boolean,
  ): Checklist {
    const snapshot = flow.plan.find((s) => s.template.id === templateId)!;
    return {
      id: uid(),
      flowId: flow.id,
      templateId,
      creatorId: automatic ? 0 : this.user.id,
      ownerId: automatic ? null : this.user.id,
      owner: automatic ? '' : this.user.name,
      created: now(),
      updated: now(),
      status: automatic ? 'Em andamento' : 'Rascunho',
      automatic,
      answers: Object.fromEntries(
        snapshot.template.sections.flatMap((s) =>
          s.questions.map((q) => [
            q.id,
            {
              value: '',
              description: '',
              fields: Object.fromEntries(
                q.fields.map((f) => [f.id, f.defaultValue]),
              ),
              problems: [],
            },
          ]),
        ),
      ),
      fields: Object.fromEntries(
        snapshot.category.fields.map((f) => [f.id, f.defaultValue]),
      ),
      departments: [],
      media: [],
      comments: [],
      logs: [],
      revisions: [],
    };
  }

  async createRecord(input: ChecklistRecordCreate): Promise<Checklist> {
    return this.normalizeRecord(await firstValueFrom(this.api.createRecord(input)));
  }

  async saveRecord(record: Checklist, flow: Flow, finish: boolean, confirmOpenMemorandos = false, context?: { blocked: boolean; creating?: boolean; previous?: string }): Promise<Checklist> {
    const old = this.state().records.find((item) => item.id === record.id);
    const snapshot = flow.plan.find(
      (s) => s.template.id === record.templateId,
    )!;
    if (!context && (old ? !this.editable(old) : !this.canOperate(snapshot.category.id)))
      throw new Error('Você não pode editar este registro.');
    if (finish) {
      if (context?.blocked ?? blockingPredecessor(record, flow, this.state().records))
        throw new Error(
          'Um checklist anterior está em revisão ou ainda não foi finalizado.',
        );
      const error = validateRecord(record, flow, this.state().nokFields);
      if (error) throw new Error(error);
    }
    let target = record;
    if ((context?.creating && Number(record.id) < 0) || (!old && !context)) {
      target = this.normalizeRecord(await firstValueFrom(this.api.createRecord({
        templateId: record.templateId,
        predecessorRecordId: context?.previous,
        serial: flow.serial,
        order: flow.order,
        clientId: flow.clientId,
        client: flow.client,
        item: flow.item,
        seller: flow.seller,
      })));
      // Keep the draft identity if an upload or the following save needs a retry.
      const { answers, fields, departments, media } = record;
      Object.assign(record, target, { answers, fields, departments, media });
      target = record;
    }
    for (const answer of Object.values(record.answers)) {
      for (const problem of answer.problems) {
        if (Number(problem.id) < 0) problem.id = await this.api.nestedId();
      }
    }
    try {
      await this.synchronizeEvidence(target.id, old, record);
    } finally {
      this.uploadState.set(null);
    }
    const saved = this.normalizeRecord(await firstValueFrom(this.api.saveRecord({ ...target, answers: record.answers, fields: record.fields, departments: record.departments }, finish, confirmOpenMemorandos)));
    if (context) return saved;
    const savedFlow = this.normalizeFlow(await firstValueFrom(this.api.getFlow(saved.id)));
    this.state.update((data) => ({
      ...data,
      records: [...data.records.filter((item) => item.id !== record.id && item.id !== saved.id), saved],
      flows: [...data.flows.filter((item) => item.id !== flow.id && item.id !== savedFlow.id), savedFlow],
    }));
    return saved;
  }

  private async synchronizeEvidence(recordId: string, previous: Checklist | undefined, submitted: Checklist): Promise<void> {
    const previousIds = new Set([
      ...(previous?.media ?? []).map((item) => item.id),
      ...Object.values(previous?.answers ?? {}).flatMap((answer) => answer.problems).flatMap((problem) => problem.media).map((item) => item.id),
    ]);
    const submittedMedia = [
      ...submitted.media.map((evidence) => ({ problemId: CHECKLIST_BODY_EVIDENCE_ID, evidence })),
      ...Object.values(submitted.answers).flatMap((answer) => answer.problems.map((problem) => ({ problem, media: problem.media }))).flatMap(({ problem, media }) => media.map((evidence) => ({ problemId: problem.id, evidence }))),
    ];
    const submittedIds = new Set(submittedMedia.map(({ evidence }) => evidence.id));
    await Promise.all([...previousIds].filter((id) => !submittedIds.has(id)).map((id) => firstValueFrom(this.api.deleteEvidence(recordId, id))));
    const pending = submittedMedia.filter(({ evidence }) => this.mediaPreview.getFile(evidence.id));
    let current = 0;
    for (const { problemId, evidence } of pending) {
      const file = this.mediaPreview.getFile(evidence.id);
      if (!file) continue;
      current++;
      const kind = file.type.startsWith('image/') ? 'image' : 'video';
      this.uploadState.set({ fileName: file.name, kind, progress: 0, current, total: pending.length });
      if (file.type.startsWith('image/')) {
        await firstValueFrom(this.api.uploadImages(recordId, problemId, [file]));
        this.uploadState.set({ fileName: file.name, kind, progress: 100, current, total: pending.length });
      } else {
        await this.uploadVideo(recordId, problemId, file, (progress) => this.uploadState.set({ fileName: file.name, kind, progress, current, total: pending.length }));
      }
      this.mediaPreview.remove(evidence.id);
    }
  }

  private async uploadVideo(recordId: string, problemId: string, file: File, onProgress: (progress: number) => void): Promise<void> {
    const info = await firstValueFrom(this.api.createVideo(recordId, problemId, file.name));
    await new Promise<void>((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: info.upload.uploadEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        headers: {
          AuthorizationSignature: info.upload.authorizationSignature,
          AuthorizationExpire: String(info.upload.authorizationExpire),
          VideoId: info.upload.bunnyVideoId,
          LibraryId: info.upload.libraryId,
        },
        metadata: { filetype: file.type, title: file.name },
        onProgress: (uploaded, total) => onProgress(total ? Math.round(uploaded * 100 / total) : 0),
        onError: reject,
        onSuccess: () => resolve(),
      });
      upload.start();
    });
    await firstValueFrom(this.api.completeVideo(recordId, info.evidence.id));
  }
  private auditAction(action: string): string {
    return ({ FINISHED_WITH_OPEN_MEMORANDOS: 'Confirmou a finalização com memorandos não aprovados', SERIAL_WAIVED: 'Série dispensada pelo administrador', SERIAL_PLATE_UPDATED: 'Dados atualizados pelo PCP', CREATED: 'Checklist iniciado', SAVED: 'Salvo', COMMENTED: 'Comentário adicionado', COMMENT_UPDATED: 'Comentário atualizado', COMMENT_DELETED: 'Comentário excluído', FINISHED: 'Checklist finalizado', FINISHED_INPUT: 'Checklist finalizado', CLAIMED: 'Assumiu o preenchimento do checklist', DELEGATED: 'Delegou o checklist para outro operador', REOPENED: 'Checklist reaberto para edição', CANCELLED: 'Cancelou o fluxo de checklist', TREATED: 'Tratado', PROBLEM_TREATED: 'Tratou uma não conformidade (NOK)', TREATMENT_REVERSED: 'Reverteu o tratamento de uma não conformidade', ORDER_UPDATED: 'Pedido atualizado', SERIAL_UPDATED: 'Número de série atualizado', CATEGORY_SKIPPED: 'Categoria ignorada', CHECKLIST_SKIPPED: 'Checklist justificado', GENERATED: 'Checklist gerado automaticamente pelo fluxo' } as Record<string, string>)[action] ?? action;
  }
  async treat(recordId: string, problemId: string, justification: string): Promise<void> {
    const record = this.normalizeRecord(await firstValueFrom(this.api.treat(recordId, problemId, justification)));
    this.state.update((data) => ({ ...data, records: data.records.map((item) => item.id === recordId ? record : item) }));
  }
  async reopen(id: string, reason: string): Promise<void> {
    this.requireAdmin();
    await firstValueFrom(this.api.reopen(id, reason));
  }

  async delegate(id: string, userId: number): Promise<void> {
    const record = this.normalizeRecord(await firstValueFrom(this.api.delegate(id, userId)));
    this.state.update((data) => ({ ...data, records: data.records.map((item) => item.id === id ? record : item) }));
  }

  async updateSerial(id: string, serial: string): Promise<void> {
    const flow = this.normalizeFlow(await firstValueFrom(this.api.updateSerial(id, serial)));
    const data = copy(this.state());
    data.flows = data.flows.map((item) => item.id === flow.id ? flow : item);
    this.state.set(data);
  }

  async addComment(recordId: string, text: string): Promise<void> {
    await firstValueFrom(this.api.addComment(recordId, text));
    await this.refreshRecord(recordId);
  }

  async updateComment(recordId: string, commentId: string, text: string): Promise<void> {
    await firstValueFrom(this.api.updateComment(recordId, commentId, text));
    await this.refreshRecord(recordId);
  }

  async deleteComment(recordId: string, commentId: string): Promise<void> {
    await firstValueFrom(this.api.deleteComment(recordId, commentId));
    await this.refreshRecord(recordId);
  }

  async deleteDraft(recordId: string): Promise<void> {
    await firstValueFrom(this.api.deleteDraft(recordId));
    this.state.update(data => {
      const records = data.records.filter(record => record.id !== recordId);
      return { ...data, records, flows: data.flows.filter(flow => records.some(record => record.flowId === flow.id)) };
    });
  }

  async cancelFlow(recordId: string, reason: string): Promise<void> {
    await firstValueFrom(this.api.cancel(recordId, reason));
  }

  async skipChecklist(recordId: string, reason: string): Promise<void> {
    this.requireAdmin();
    await firstValueFrom(this.api.skip(recordId, reason));
  }

  async loadRecordContext(recordId: string, editing = false): Promise<ChecklistRecordContext> {
    const version = ++this.contextLoadVersion;
    const context = await firstValueFrom(this.api.getRecordContext(recordId, editing));
    const record = this.normalizeRecord(context.record);
    const flow = this.normalizeFlow(context.flow);
    if (version === this.contextLoadVersion) {
      this.state.update(data => ({
        ...data,
        records: [record],
        flows: [flow],
      }));
    }
    return {
      ...context, record, flow,
      previousId: context.previousId == null ? null : String(context.previousId),
      nextId: context.nextId == null ? null : String(context.nextId),
      steps: context.steps.map(step => ({
        ...step,
        templateId: String(step.templateId),
        recordId: step.recordId == null ? null : String(step.recordId),
        status: step.status && (this.statuses[step.status] ?? step.status),
      })),
    };
  }

  private async refreshRecord(recordId: string): Promise<void> {
    const record = this.normalizeRecord(await firstValueFrom(this.api.getRecord(recordId)));
    this.state.update(data => ({
      ...data, records: data.records.map(item => item.id === recordId ? record : item),
    }));
  }
}

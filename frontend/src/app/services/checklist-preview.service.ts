import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { UserService } from './user.service';
import { Checklist, ChecklistState, Flow, Template } from '../interface/checklist.interface';
import { checklistCopy as copy, checklistId as uid, checklistNow as now, defaultChecklistNokFields } from '../shared/checklist-factory';
import { blockingPredecessor, migrateTitleFormula, normalizeChecklistIntegration, recordTitle, validateRecord, validateTemplate } from '../shared/checklist-rules';
import { ChecklistCatalogEntry, ChecklistRecordCreate, ChecklistService } from './checklist.service';
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

  get user() { return this.users.getCurrentUser()! }
  get admin() { return this.user.roles.some((r) => ['ROLE_ADMIN', 'ROLE_CHECKLIST_ADMIN'].includes(r.authority)) }
  get operator() { return (this.admin || this.user.roles.some((r) => r.authority === 'ROLE_CHECKLIST_OPERATOR')) }

  load(force = false): Promise<void> {
    if (this.loading && !force) return this.loading;
    this.loading = this.fetchState().finally(() => this.loading = undefined);
    return this.loading;
  }

  commit(data: ChecklistState): Promise<boolean> {
    const previous = this.state();
    this.state.set(copy(data));
    return this.persistConfiguration(previous, data);
  }

  private async fetchState(): Promise<void> {
    try {
      const result = await firstValueFrom(forkJoin({
        categories: this.api.listCategories(),
        equipment: this.api.listEquipment(),
        templates: this.api.listTemplates(),
        records: this.api.listRecords(),
        flows: this.api.listFlows(),
        items: this.api.listCatalog('ITEM'),
        defects: this.api.listCatalog('DEFECT'),
      }));
      this.catalogEntries = [...result.items, ...result.defects];
      const records = result.records.content.map((record) => this.normalizeRecord(record));
      const flows = result.flows.map((flow) => this.normalizeFlow(flow));
      result.categories.forEach((category) => {
        category.id = String(category.id);
        category.integration = normalizeChecklistIntegration(category.integration);
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
        processes: [],
      });
      this.warning.set('');
    } catch {
      this.warning.set('Não foi possível carregar os checklists do servidor. Tente novamente.');
      throw new Error(this.warning());
    }
  }

  private emptyState(): ChecklistState {
    return { schema: 1, categories: [], equipment: [], templates: [], flows: [], records: [], items: [], defects: [], nokFields: defaultChecklistNokFields(), processes: [] };
  }

  private normalizeRecord(record: Checklist): Checklist {
    const statuses: Record<string, Checklist['status']> = { DRAFT: 'Rascunho', IN_PROGRESS: 'Em andamento', PENDING: 'Pendente', FINISHED: 'Finalizado', CANCELLED: 'Cancelado' };
    record.id = String(record.id);
    record.flowId = String(record.flowId);
    record.templateId = String(record.templateId);
    record.status = statuses[record.status] ?? record.status;
    record.comments ??= [];
    record.logs ??= [];
    record.revisions ??= [];
    record.fields ??= {};
    record.comments.forEach((comment) => comment.id = String(comment.id));
    record.logs.forEach((log) => {
      log.id = String(log.id);
      log.action = this.auditAction(log.action);
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
      if (statuses[snapshot.status]) snapshot.status = statuses[snapshot.status];
    });
    return record;
  }

  private normalizeFlow(flow: Flow): Flow {
    flow.id = String(flow.id);
    flow.serial ??= '';
    flow.order ??= '';
    flow.clientId ??= '';
    flow.client ??= '';
    flow.item ??= '';
    flow.seller ??= '';
    flow.skipped ??= {};
    flow.plan.forEach((snapshot) => {
      snapshot.category.id = String(snapshot.category.id);
      snapshot.template.id = String(snapshot.template.id);
      snapshot.template.categoryId = String(snapshot.template.categoryId);
      snapshot.template.equipmentId = snapshot.template.equipmentId == null ? '' : String(snapshot.template.equipmentId);
      snapshot.template.predecessorId = snapshot.template.predecessorId == null ? '' : String(snapshot.template.predecessorId);
    });
    return flow;
  }

  private normalizeTemplate(template: Template): Template {
    template.id = String(template.id);
    template.categoryId = String(template.categoryId);
    template.equipmentId = template.equipmentId == null ? '' : String(template.equipmentId);
    template.predecessorId = template.predecessorId == null ? '' : String(template.predecessorId);
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
      if (requests.length) await this.load(true);
      return true;
    } catch {
      await this.load(true).catch(() => undefined);
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
      (this.operator && r.creatorId === this.user.id)
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

  clientNokHistoryEnabled(categoryId: string): boolean {
    return this.state().categories.find((category) => category.id === categoryId)?.clientNokHistory ?? false;
  }

  async updateFlowOrder(flowId: string, orderNumber: string, item: string): Promise<void> {
    this.requireAdmin();
    const record = this.state().records.find((item) => item.flowId === flowId);
    if (!record) throw new Error('Fluxo não encontrado.');
    await firstValueFrom(this.api.updateOrder(record.id, orderNumber, item));
    await this.load(true);
  }

  blocked(r: Checklist): boolean {
    return blockingPredecessor(r, this.flow(r), this.state().records);
  }

  log(r: Checklist, action: string): void {
    r.updated = now();
    r.logs.push({ id: uid(), at: r.updated, actor: this.user.name, action });
  }

  async claim(id: string): Promise<void> {
    const current = this.state().records.find((r) => r.id === id)!;
    if (!this.editable(current))
      throw new Error('Este registro não está disponível para preenchimento.');
    if (current.ownerId !== null) return;
    const record = this.normalizeRecord(await firstValueFrom(this.api.claim(id)));
    this.state.update((data) => ({ ...data, records: data.records.map((item) => item.id === id ? record : item) }));
  }

  async saveTemplate(model: Template): Promise<void> {
    this.requireAdmin();
    const category = this.state().categories.find((item) => item.id === model.categoryId);
    if (category?.integration === 'production') {
      model.name = this.state().equipment.find((item) => item.id === model.equipmentId)?.abbreviation || '';
      model.signature = true;
    }
    const error = validateTemplate(model, this.state());
    if (error) throw new Error(error);
    const previous = this.state().templates.find((item) => item.id === model.id);
    const saved = this.normalizeTemplate(await firstValueFrom(previous ? this.api.updateTemplate(model) : this.api.createTemplate(model)));
    this.state.update((data) => ({ ...data, templates: [...data.templates.filter((item) => item.id !== model.id), saved] }));
  }

  async deleteTemplate(id: string): Promise<void> {
    this.requireAdmin();
    await firstValueFrom(this.api.deleteTemplate(id));
    this.state.update(data => ({
      ...data,
      templates: data.templates.filter(template => template.id !== id),
    }));
  }

  newRecord(
    templateId: string,
    predecessorId = '',
  ): { record: Checklist; flow: Flow } {
    const template = this.state().templates.find((t) => t.id === templateId);
    if (!template) throw new Error('Modelo não encontrado.');
    const category = this.state().categories.find(
      (c) => c.id === template.categoryId,
    )!;
    if (!category.active || !this.canOperate(category.id))
      throw new Error('Categoria indisponível para operação.');
    let flow: Flow;
    if (predecessorId) {
      const previous = this.state().records.find((r) => r.id === predecessorId);
      if (
        !previous ||
        !this.visible(previous) ||
        previous.status !== 'Finalizado' ||
        this.blocked(previous)
      )
        throw new Error('Selecione um predecessor finalizado e sem bloqueios.');
      flow = copy(this.flow(previous));
      const next = this.nextSnapshot(flow, previous.templateId);
      if (
        !next ||
        next.template.id !== templateId ||
        next.template.automatic ||
        this.state().records.some(
          (r) => r.flowId === flow.id && r.templateId === templateId,
        )
      )
        throw new Error('Este fluxo não permite esta inserção manual.');
    } else {
      if (template.predecessorId)
        throw new Error('Selecione o registro anterior elegível.');
      const error = validateTemplate(template, this.state());
      if (error) throw new Error(`Modelo precisa de configuração: ${error}`);
      flow = {
        id: uid(),
        serial: '',
        order: '',
        clientId: '',
        client: '',
        item: '',
        seller: '',
        plan: [],
        skipped: {},
        cancelled: false,
      };
      let cursor: Template | undefined = template;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor.id)) {
        seen.add(cursor.id);
        flow.plan.push({
          template: copy(cursor),
          category: copy(
            this.state().categories.find((c) => c.id === cursor!.categoryId)!,
          ),
          equipment:
            this.state().equipment.find((e) => e.id === cursor!.equipmentId)
              ?.name || '',
        });
        cursor = this.state().templates.find(
          (t) => t.predecessorId === cursor!.id,
        );
      }
    }
    const record = this.makeRecord(flow, templateId, false);
    return { record, flow };
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
      comments: [],
      logs: [],
      revisions: [],
    };
  }

  async createRecord(input: ChecklistRecordCreate): Promise<Checklist> {
    this.newRecord(input.templateId, input.predecessorRecordId);
    const record = this.normalizeRecord(await firstValueFrom(this.api.createRecord(input)));
    const flow = this.normalizeFlow(await firstValueFrom(this.api.getFlow(record.id)));
    this.state.update((data) => ({
      ...data,
      records: [...data.records.filter((item) => item.id !== record.id), record],
      flows: [...data.flows.filter((item) => item.id !== flow.id), flow],
    }));
    return record;
  }

  async saveRecord(record: Checklist, flow: Flow, finish: boolean): Promise<Checklist> {
    const old = this.state().records.find((item) => item.id === record.id);
    const snapshot = flow.plan.find(
      (s) => s.template.id === record.templateId,
    )!;
    if (old ? !this.editable(old) : !this.canOperate(snapshot.category.id))
      throw new Error('Você não pode editar este registro.');
    if (finish) {
      if (blockingPredecessor(record, flow, this.state().records))
        throw new Error(
          'Um checklist anterior está em revisão ou ainda não foi finalizado.',
        );
      const error = validateRecord(record, flow, this.state().nokFields);
      if (error) throw new Error(error);
    }
    let target = record;
    if (!old) {
      target = this.normalizeRecord(await firstValueFrom(this.api.createRecord({
        templateId: record.templateId,
        predecessorRecordId: this.findPredecessorRecordId(record, flow),
        serial: flow.serial,
        order: flow.order,
        clientId: flow.clientId,
        client: flow.client,
        item: flow.item,
        seller: flow.seller,
      })));
      target.answers = record.answers;
      target.fields = record.fields;
      target.departments = record.departments;
    }
    try {
      await this.synchronizeEvidence(target.id, old, record);
    } finally {
      this.uploadState.set(null);
    }
    const saved = this.normalizeRecord(await firstValueFrom(this.api.saveRecord({ ...target, answers: record.answers, fields: record.fields, departments: record.departments }, finish)));
    const savedFlow = this.normalizeFlow(await firstValueFrom(this.api.getFlow(saved.id)));
    this.state.update((data) => ({
      ...data,
      records: [...data.records.filter((item) => item.id !== record.id && item.id !== saved.id), saved],
      flows: [...data.flows.filter((item) => item.id !== flow.id && item.id !== savedFlow.id), savedFlow],
    }));
    return saved;
  }

  private findPredecessorRecordId(record: Checklist, flow: Flow): string | undefined {
    const template = this.state().templates.find((item) => item.id === record.templateId);
    if (!template?.predecessorId) return undefined;
    return this.state().records.find((item) => item.flowId === flow.id && item.templateId === template.predecessorId)?.id;
  }

  private async synchronizeEvidence(recordId: string, previous: Checklist | undefined, submitted: Checklist): Promise<void> {
    const previousIds = new Set(Object.values(previous?.answers ?? {}).flatMap((answer) => answer.problems).flatMap((problem) => problem.media).map((item) => item.id));
    const submittedMedia = Object.values(submitted.answers).flatMap((answer) => answer.problems.map((problem) => ({ problem, media: problem.media }))).flatMap(({ problem, media }) => media.map((evidence) => ({ problemId: problem.id, evidence })));
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
    return ({ CREATED: 'Criado', SAVED: 'Salvo', COMMENTED: 'Comentário adicionado', COMMENT_UPDATED: 'Comentário atualizado', COMMENT_DELETED: 'Comentário excluído', FINISHED: 'Finalizado', FINISHED_INPUT: 'Preenchimento finalizado', CLAIMED: 'Assumido', DELEGATED: 'Delegado', REOPENED: 'Reaberto', CANCELLED: 'Cancelado', TREATED: 'Tratado', PROBLEM_TREATED: 'Problema tratado', TREATMENT_REVERSED: 'Tratamento revertido', ORDER_UPDATED: 'Pedido atualizado', SERIAL_UPDATED: 'Número de série atualizado', CATEGORY_SKIPPED: 'Categoria ignorada', GENERATED: 'Gerado automaticamente' } as Record<string, string>)[action] ?? action;
  }
  private nextSnapshot(flow: Flow, templateId: string) {
    let index = flow.plan.findIndex((s) => s.template.id === templateId) + 1;
    while (
      index < flow.plan.length &&
      flow.skipped[flow.plan[index].template.id]
    )
      index++;
    return flow.plan[index];
  }
  refreshFlows(data: ChecklistState): void {
    for (const record of [...data.records])
      if (!data.flows.find((f) => f.id === record.flowId)?.cancelled)
        this.advance(data, record);
    this.reconcile(data);
  }
  private advance(data: ChecklistState, record: Checklist): void {
    const flow = data.flows.find((f) => f.id === record.flowId)!;
    if (
      record.status !== 'Finalizado' ||
      blockingPredecessor(record, flow, data.records)
    )
      return;
    const index = flow.plan.findIndex(
      (s) => s.template.id === record.templateId,
    );
    for (const snapshot of flow.plan.slice(index + 1)) {
      if (
        data.records.some(
          (r) => r.flowId === flow.id && r.templateId === snapshot.template.id,
        )
      )
        break;
      if (flow.skipped[snapshot.template.id]) continue;
      const category = data.categories.find(
        (c) => c.id === snapshot.category.id,
      )!;
      if (!category.active) {
        flow.skipped[snapshot.template.id] = category.reason;
        this.log(
          data.records.find((r) => r.id === record.id)!,
          `Categoria ${category.name} pulada: ${category.reason}`,
        );
        continue;
      }
      if (snapshot.template.automatic) {
        const next = this.makeRecord(flow, snapshot.template.id, true);
        this.log(next, 'Gerado automaticamente após conclusão do requisito');
        data.records.push(next);
      }
      break;
    }
    this.evaluateProcesses(data);
  }
  evaluateProcesses(data: ChecklistState): void {
    for (const process of data.processes.filter(
      (p) => p.requested && !p.done && !p.cancelled,
    )) {
      process.done =
        process.flowIds.length > 0 &&
        process.flowIds.every((id) => {
          const flow = data.flows.find((f) => f.id === id)!;
          const record = data.records.find(
            (r) =>
              r.flowId === id &&
              flow.plan.find((s) => s.template.id === r.templateId)?.category
                .id === process.categoryId,
          );
          return (
            !!record &&
            !flow.cancelled &&
            record.status === 'Finalizado' &&
            !blockingPredecessor(record, flow, data.records)
          );
        });
    }
  }
  private reconcile(data: ChecklistState): void {
    for (let pass = 0; pass < data.records.length; pass++) {
      let changed = false;
      for (const record of [...data.records]) {
        const flow = data.flows.find((f) => f.id === record.flowId)!;
        if (
          record.status !== 'Pendente' ||
          flow.cancelled ||
          blockingPredecessor(record, flow, data.records)
        )
          continue;
        if (
          Object.values(record.answers)
            .flatMap((a) => a.problems)
            .some((p) => !p.treated)
        )
          continue;
        record.status = 'Finalizado';
        record.finished = now();
        this.log(
          record,
          'Finalizado após liberação da revisão anterior e tratamento de todas as ocorrências',
        );
        this.advance(data, record);
        changed = true;
      }
      if (!changed) break;
    }
    this.evaluateProcesses(data);
  }
  async treat(recordId: string, problemId: string, justification: string): Promise<void> {
    const record = this.normalizeRecord(await firstValueFrom(this.api.treat(recordId, problemId, justification)));
    this.state.update((data) => ({ ...data, records: data.records.map((item) => item.id === recordId ? record : item) }));
  }
  async reopen(id: string, reason: string): Promise<void> {
    this.requireAdmin();
    const record = this.normalizeRecord(await firstValueFrom(this.api.reopen(id, reason)));
    this.state.update((data) => ({ ...data, records: data.records.map((item) => item.id === id ? record : item) }));
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
    await this.load(true);
  }

  async cancelFlow(recordId: string, reason: string): Promise<void> {
    await firstValueFrom(this.api.cancel(recordId, reason));
    await this.load(true);
  }

  private async refreshRecord(recordId: string): Promise<void> {
    const record = this.normalizeRecord(await firstValueFrom(this.api.getRecord(recordId)));
    this.state.update((data) => ({ ...data, records: data.records.map((item) => item.id === recordId ? record : item) }));
  }
}

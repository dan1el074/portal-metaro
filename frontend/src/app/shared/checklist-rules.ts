import { Checklist, ChecklistState, Flow, Integration, NokFormField, Problem, Template } from '../interface/checklist.interface';
import { defaultChecklistNokFields } from './checklist-factory';

export function normalizeChecklistIntegration(value: unknown): Integration {
  const normalized = String(value ?? '').trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['production', 'producao', 'integracao producao'].includes(normalized)) return 'production';
  if (['5s', 'integracao 5s'].includes(normalized)) return '5s';
  return 'none';
}

export function checklistIntegrationLabel(integration: Integration): string {
  if (integration === 'production') return 'Integração Produção';
  if (integration === '5s') return 'Integração 5S';
  return 'Nenhuma';
}

export function validateTemplate(
  model: Template,
  state: ChecklistState,
): string | null {
  const category = state.categories.find((c) => c.id === model.categoryId);
  if (!category) return 'Informe a categoria do modelo.';
  if (category.integration !== 'production' && !model.name.trim())
    return 'Informe o nome do modelo.';
  if (category.integration === 'production' && !model.signature)
    return 'A assinatura é obrigatória em modelos com Integração Produção.';
  if (
    model.sections.some((s) => !s.options.includes('N/A'))
  )
    return 'N/A é obrigatório em todas as seções.';
  if (
    category.integration === 'production' &&
    (!model.equipmentId ||
      state.templates.some(
        (t) =>
          t.id !== model.id &&
          t.categoryId === model.categoryId &&
          t.equipmentId === model.equipmentId,
      ))
  )
    return 'Selecione um equipamento ainda não utilizado nesta categoria.';
  if (
    !model.sections.length ||
    model.sections.some(
      (s) =>
        !s.name.trim() ||
        !s.questions.length ||
        s.questions.some((q) => !q.label.trim()) ||
        !s.options.length ||
        new Set(s.options).size !== s.options.length,
    )
  )
    return 'Preencha todas as seções, perguntas e opções, sem opções repetidas.';
  if (
    model.sections.some((s) =>
      category.integration === 'production'
        ? !s.options.includes('NOK')
        : s.options.includes('NOK'),
    )
  )
    return 'NOK é obrigatório em Produção e não é permitido nas demais integrações.';
  const fields = model.sections.flatMap((s) =>
    s.questions.flatMap((q) => q.fields),
  );
  if (
    fields.some(
      (f) => !f.label.trim() || (f.type === 'select' && !f.options.length),
    )
  )
    return 'Configure nome e opções dos campos adicionais.';
  if (model.predecessorId) {
    const previous = state.templates.find((t) => t.id === model.predecessorId);
    if (
      !previous ||
      previous.id === model.id ||
      previous.categoryId === model.categoryId
    )
      return 'O requisito deve pertencer a outra categoria.';
    if (
      state.templates.some(
        (t) => t.id !== model.id && t.predecessorId === model.predecessorId,
      )
    )
      return 'Este requisito já tem um sucessor. Bifurcações não são permitidas.';
    const predecessorCategory = state.categories.find(
      (c) => c.id === previous.categoryId,
    )!;
    if (category.integration !== predecessorCategory.integration)
      return 'Os requisitos devem usar o mesmo tipo de integração.';
    if (
      category.integration === 'production' &&
      model.equipmentId !== previous.equipmentId
    )
      return 'O requisito deve usar o mesmo equipamento.';
    if (category.erp && !predecessorCategory.erp)
      return 'O requisito deve disponibilizar os dados ERP herdados.';
    const seen = new Set([model.id]);
    let cursor: Template | undefined = previous;
    while (cursor) {
      if (seen.has(cursor.id)) return 'O requisito criaria um ciclo.';
      seen.add(cursor.id);
      cursor = state.templates.find((t) => t.id === cursor!.predecessorId);
    }
  }
  const keys = new Set([
    'data',
    ...model.sections.flatMap((s) =>
      s.questions.flatMap((q) => [q.id, ...q.fields.map((f) => f.id)]),
    ),
    ...category.fields.map((f) => f.id),
  ]);
  if ([...model.title.matchAll(/\{([^}]+)\}/g)].some((m) => !keys.has(m[1])))
    return 'O título contém uma variável que não existe mais.';
  return null;
}

export function blockingPredecessor(
  record: Checklist,
  flow: Flow,
  records: Checklist[],
): boolean {
  const index = flow.plan.findIndex((s) => s.template.id === record.templateId);
  return flow.plan
    .slice(0, index)
    .some(
      (s) =>
        !flow.skipped[s.template.id] &&
        records.find(
          (r) => r.flowId === flow.id && r.templateId === s.template.id,
        )?.status !== 'Finalizado',
    );
}

export function nokFieldValue(problem: Problem, field: NokFormField): string {
  if (field.binding === 'media') return problem.media.length ? String(problem.media.length) : '';
  return String(field.binding ? problem[field.binding] ?? '' : problem.customFields?.[field.id] || '');
}

export function setNokFieldValue(problem: Problem, field: NokFormField, value: string): void {
  if (field.binding === 'media') return;
  const normalized = String(value ?? '');
  if (field.binding) problem[field.binding] = normalized;
  else (problem.customFields ??= {})[field.id] = normalized;
}

export function validateRecord(record: Checklist, flow: Flow, nokFields = defaultChecklistNokFields()): string | null {
  const snap = flow.plan.find((s) => s.template.id === record.templateId)!;
  if (snap.category.serial && !flow.serial.trim())
    return 'Informe o número de série.';
  if (snap.category.erp && (!flow.order || !flow.item || !flow.clientId))
    return 'Selecione o pedido e o item na consulta ao ERP.';
  if (snap.category.departments && !record.departments.length)
    return 'Selecione pelo menos um setor.';
  if (snap.category.fields.some((f) => !record.fields[f.id]?.trim()))
    return 'Preencha os campos obrigatórios do cabeçalho.';
  for (const section of snap.template.sections) {
    for (const question of section.questions) {
      const answer = record.answers[question.id];
      if (
        !answer ||
        !section.options.includes(answer.value) ||
        (answer.value !== 'N/A' && question.fields.some((f) => !answer.fields[f.id]?.trim()))
      )
        return 'Responda todas as perguntas e campos adicionais.';
      if (
        answer.value === 'NOK' &&
        (!answer.problems.length ||
          answer.problems.some((problem) =>
            nokFields.some((field) => field.required && !nokFieldValue(problem, field).trim()),
          ))
      )
        return 'Cada NOK precisa de pelo menos um problema completo.';
    }
  }
  return null;
}

export function recordTitle(record: Checklist, flow: Flow): string {
  const template = flow.plan.find(
    (s) => s.template.id === record.templateId,
  )!.template;
  const values: Record<string, string> = {
    '%data': new Date(record.created).toLocaleString('pt-BR'),
    '%serie': flow.serial,
    '%pedido': flow.order,
    '%cliente': flow.client,
    '%item': flow.item,
    '%vendedor': flow.seller,
  };
  template.sections.forEach((section, sectionIndex) =>
    section.questions.forEach((question, questionIndex) => {
      values[`%${sectionIndex + 1}.${questionIndex + 1}`] = record.answers[question.id]?.value || '';
    }),
  );
  const title = template.title
    .replace(/%(?:data|serie|pedido|cliente|item|vendedor|\d+\.\d+)/g, (token) => values[token] || '…')
    .replace(/\{data\}/g, values['%data'])
    .replace(/\{([^}]+)\}/g, (_, id: string) => record.answers[id]?.value || '…')
    .trim();
  return title || `${template.name} · ${record.id.slice(0, 8)}`;
}

export function migrateTitleFormula(template: Template): void {
  template.title = template.title.replace(/\{data\}/g, '%data');
  template.sections.forEach((section, sectionIndex) =>
    section.questions.forEach((question, questionIndex) => {
      template.title = template.title.replaceAll(
        `{${question.id}}`,
        `%${sectionIndex + 1}.${questionIndex + 1}`,
      );
    }),
  );
}

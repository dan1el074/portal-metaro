package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.UserRepository;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ForbiddenException;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.*;
import br.com.metaro.portal.util.erp.ErpOrderQueryService;
import br.com.metaro.portal.util.erp.ErpSource;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import br.com.metaro.portal.util.erp.dto.ErpOrderItemDto;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChecklistRecordService {
    private final ChecklistRecordRepository recordRepository;
    private final ChecklistFlowRepository flowRepository;
    private final ChecklistTemplateRepository templateRepository;
    private final ChecklistCategoryRepository categoryRepository;
    private final ChecklistCatalogEntryRepository catalogRepository;
    private final ChecklistCommentRepository commentRepository;
    private final ChecklistAuditRepository auditRepository;
    private final ChecklistRevisionRepository revisionRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ChecklistMapper mapper;
    private final ErpOrderQueryService erpOrderQueryService;
    private final ChecklistStepFlowService checklistStepFlowService;
    private final ChecklistEvidenceService checklistEvidenceService;

    @Transactional(readOnly = true)
    public Page<ChecklistRecordDto> listRecords(Pageable pageable) {
        User user = userService.authenticate();
        return recordRepository.findVisible(pageable, user.getId(), isAdministrator(user)).map(mapper::toDto);
    }

    @Transactional(readOnly = true)
    public List<ChecklistFlowDto> listVisibleFlows() {
        User user = userService.authenticate();
        return recordRepository.findVisible(Pageable.unpaged(), user.getId(), isAdministrator(user)).stream()
                .map(ChecklistRecord::getFlow)
                .collect(java.util.stream.Collectors.toMap(ChecklistFlow::getId, mapper::toDto, (first, ignored) -> first, LinkedHashMap::new))
                .values().stream().toList();
    }

    @Transactional(readOnly = true)
    public ChecklistRecordDto getRecord(Long id) {
        ChecklistRecord record = findRecord(id);
        assertVisible(record, userService.authenticate());
        return mapper.toDto(record);
    }

    @Transactional(readOnly = true)
    public ChecklistFlowDto getFlow(Long id) {
        ChecklistFlow flow = flowRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        List<ChecklistRecord> records = recordRepository.findByFlowId(id);
        if (records.isEmpty()) throw new ResourceNotFoundException();
        assertVisible(records.getFirst(), userService.authenticate());
        return mapper.toDto(flow);
    }

    @Transactional(readOnly = true)
    public List<ChecklistRecordDto> getClientHistory(String clientId) {
        if (clientId == null || clientId.isBlank()) throw new UnprocessableEntityException("É necessário informar o ID do cliente.");
        return recordRepository.findClientHistory(clientId.trim()).stream().map(mapper::toDto).toList();
    }

    @Transactional
    public ChecklistRecordDto createRecord(ChecklistRecordCreateDto input) {
        User user = userService.authenticate();
        ChecklistTemplate template = templateRepository.findById(input.getTemplateId()).orElseThrow(ResourceNotFoundException::new);
        assertCanOperate(template.getCategory(), user);
        if (!template.getCategory().isActive()) {
            throw new UnprocessableEntityException("Esta categoria de checklist está inativa.");
        }

        ChecklistFlow flow;
        if (template.getPredecessor() == null) {
            if (input.getPredecessorRecordId() != null) {
                throw new UnprocessableEntityException("Um modelo raiz não aceita um registro predecessor.");
            }
            flow = createFlow(template, input);
        } else {
            flow = resolveManualSuccessorFlow(template, input.getPredecessorRecordId(), user);
        }
        ChecklistRecord record = createEmptyRecord(flow, template, user, false);
        recordRepository.save(record);
        addAudit(record, user, "CREATED", "Registro de checklist criado manualmente.");
        return mapper.toDto(record);
    }

    @Transactional
    public ChecklistRecordDto claimRecord(Long id) {
        User user = userService.authenticate();
        ChecklistRecord record = findRecord(id);
        assertEditable(record, user);
        if (record.getOwner() == null) {
            record.setOwner(user);
            record.setUpdatedAt(Instant.now());
            addAudit(record, user, "CLAIMED", "Responsabilidade pelo checklist assumida.");
        }
        return mapper.toDto(recordRepository.save(record));
    }

    @Transactional
    public ChecklistRecordDto saveRecord(Long id, ChecklistRecordDto input, boolean finish) {
        User user = userService.authenticate();
        ChecklistRecord record = findRecord(id);
        assertEditable(record, user);
        if (input.getVersion() != record.getLockVersion()) {
            throw new UnprocessableEntityException("O checklist foi alterado por outra requisição. Recarregue antes de salvar.");
        }
        if (record.getFlow().isCancelled()) {
            throw new UnprocessableEntityException("Um fluxo de checklist cancelado não pode ser editado.");
        }
        Map<String, ChecklistAnswerDto> previousAnswers = readAnswers(record);
        Map<String, ChecklistAnswerDto> submittedAnswers = nonNull(input.getAnswers(), new HashMap<>());
        validateTreatmentIntegrity(previousAnswers, submittedAnswers);
        record.setAnswersJson(mapper.write(submittedAnswers));
        record.setFieldsJson(mapper.write(nonNull(input.getFields(), new HashMap<>())));
        record.setDepartmentsJson(mapper.write(nonNull(input.getDepartments(), new ArrayList<>())));
        record.setOwner(record.getOwner() == null ? user : record.getOwner());
        record.setUpdatedAt(Instant.now());

        if (finish) {
            assertNoBlockingPredecessor(record);
            validateCompletedRecord(record);
            record.setFinisher(user);
            record.setFinishedAt(Instant.now());
            if (record.getTemplate().isSignature()) {
                record.setSignature(user.getName());
                record.setSignedAt(record.getFinishedAt());
            }
            record.setStatus(hasUntreatedProblems(record) ? ChecklistStatus.PENDING : ChecklistStatus.FINISHED);
            addAudit(record, user, "FINISHED_INPUT", "Preenchimento do checklist encerrado com o status " + record.getStatus().name() + ".");
        } else {
            addAudit(record, user, "SAVED", "Preenchimento do checklist salvo.");
        }

        recordRepository.save(record);
        if (record.getStatus() == ChecklistStatus.FINISHED) {
            advanceFlow(record, user);
        }
        reconcileFlow(record.getFlow(), user);
        checklistStepFlowService.completeWaitingSteps(record.getFlow().getId(), user);
        return mapper.toDto(findRecord(id));
    }

    @Transactional
    public ChecklistRecordDto treatProblem(Long id, ChecklistTreatmentDto input) {
        User user = userService.authenticate();
        ChecklistRecord record = findRecord(id);
        if (record.getStatus() != ChecklistStatus.PENDING) {
            throw new UnprocessableEntityException("Os tratamentos só podem ser alterados enquanto o checklist estiver pendente.");
        }
        boolean allowed = isAdministrator(user) || record.getFinisher() != null && record.getFinisher().getId().equals(user.getId());
        if (!allowed) throw new ForbiddenException("Somente o finalizador ou um administrador de checklist pode tratar problemas.");

        Map<String, ChecklistAnswerDto> answers = readAnswers(record);
        ChecklistProblemDto problem = findProblem(answers, input.getProblemId());
        if (problem.isTreated()) {
            ChecklistComment comment = commentRepository.findByRecordIdAndProblemIdAndActiveTrue(id, problem.getId())
                    .orElse(null);
            if (comment != null) {
                comment.setActive(false);
                comment.setUpdatedAt(Instant.now());
                commentRepository.save(comment);
            }
            problem.setTreated(false);
            problem.setCommentId(null);
            addAudit(record, user, "TREATMENT_REVERSED", "Tratamento revertido para o problema " + problem.getId() + ".");
        } else {
            ChecklistComment comment = createComment(record, user, input.getJustification().trim(), problem.getId());
            problem.setTreated(true);
            problem.setCommentId(comment.getId().toString());
            addAudit(record, user, "PROBLEM_TREATED", "Problema " + problem.getId() + " tratado.");
        }
        record.setAnswersJson(mapper.write(answers));
        record.setUpdatedAt(Instant.now());
        if (allProblemsTreated(answers) && !hasBlockingPredecessor(record)) {
            record.setStatus(ChecklistStatus.FINISHED);
            record.setFinishedAt(Instant.now());
            addAudit(record, user, "FINISHED", "Todos os problemas do checklist foram tratados.");
            recordRepository.save(record);
            advanceFlow(record, user);
        } else {
            recordRepository.save(record);
        }
        reconcileFlow(record.getFlow(), user);
        checklistStepFlowService.completeWaitingSteps(record.getFlow().getId(), user);
        return mapper.toDto(findRecord(id));
    }

    @Transactional
    public ChecklistRecordDto reopenRecord(Long id, ChecklistReasonDto input) {
        User user = userService.authenticate();
        assertAdministrator(user);
        ChecklistRecord record = findRecord(id);
        if (record.getStatus() != ChecklistStatus.FINISHED) {
            throw new UnprocessableEntityException("Somente um checklist finalizado pode voltar para edição.");
        }
        ChecklistRevision revision = new ChecklistRevision();
        revision.setRecord(record);
        revision.setCreatedBy(user);
        revision.setReason(input.getReason().trim());
        revision.setSnapshotJson(mapper.write(mapper.toDto(record)));
        revision.setCreatedAt(Instant.now());
        revisionRepository.save(revision);

        record.setStatus(ChecklistStatus.IN_PROGRESS);
        record.setOwner(user);
        record.setFinisher(null);
        record.setSignature(null);
        record.setSignedAt(null);
        record.setFinishedAt(null);
        record.setUpdatedAt(Instant.now());
        addAudit(record, user, "REOPENED", input.getReason().trim());
        return mapper.toDto(recordRepository.save(record));
    }

    @Transactional
    public void cancelFlow(Long recordId, ChecklistReasonDto input) {
        User user = userService.authenticate();
        assertAdministrator(user);
        ChecklistRecord record = findRecord(recordId);
        ChecklistFlow flow = record.getFlow();
        if (checklistStepFlowService.hasActiveDependency(flow.getId())) {
            throw new UnprocessableEntityException("O fluxo de checklist é exigido por um Fluxo de etapas ativo.");
        }
        if (flow.isCancelled()) throw new UnprocessableEntityException("O fluxo de checklist já está cancelado.");
        flow.setCancelled(true);
        flow.setCancellationReason(input.getReason().trim());
        flow.setNormalizedSerial(null);
        flow.setUpdatedAt(Instant.now());
        flowRepository.save(flow);
        for (ChecklistRecord flowRecord : recordRepository.findByFlowId(flow.getId())) {
            flowRecord.setStatus(ChecklistStatus.CANCELLED);
            flowRecord.setUpdatedAt(Instant.now());
            recordRepository.save(flowRecord);
            addAudit(flowRecord, user, "CANCELLED", input.getReason().trim());
        }
    }

    @Transactional
    public void deleteDraft(Long id) throws java.io.IOException {
        User user = userService.authenticate();
        ChecklistRecord record = findRecord(id);
        if (record.getStatus() != ChecklistStatus.DRAFT || !isAdministrator(user) && !record.getCreator().getId().equals(user.getId())) {
            throw new ForbiddenException("Somente o autor do rascunho ou um administrador de checklist pode excluí-lo.");
        }
        Long flowId = record.getFlow().getId();
        checklistEvidenceService.deleteAll(id);
        recordRepository.delete(record);
        if (recordRepository.findByFlowId(flowId).isEmpty()) flowRepository.deleteById(flowId);
    }

    @Transactional
    public ChecklistCommentDto addComment(Long recordId, ChecklistCommentInputDto input) {
        User user = userService.authenticate();
        if (!isAdministrator(user) && !user.hasRole("ROLE_CHECKLIST_OPERATOR")) {
            throw new ForbiddenException("Usuários de consulta não podem comentar.");
        }
        ChecklistRecord record = findRecord(recordId);
        assertVisible(record, user);
        ChecklistComment comment = createComment(record, user, input.getText().trim(), null);
        addAudit(record, user, "COMMENTED", "Comentário adicionado.");
        return mapper.toDto(comment);
    }

    @Transactional
    public ChecklistCommentDto updateComment(Long recordId, Long commentId, ChecklistCommentInputDto input) {
        User user = userService.authenticate();
        ChecklistComment comment = commentRepository.findByIdAndRecordId(commentId, recordId).orElseThrow(ResourceNotFoundException::new);
        if (!comment.isActive() || !isAdministrator(user) && !comment.getAuthor().getId().equals(user.getId())) {
            throw new ForbiddenException("Somente o autor do comentário ou um administrador de checklist pode editá-lo.");
        }
        comment.setContent(input.getText().trim());
        comment.setUpdatedAt(Instant.now());
        addAudit(comment.getRecord(), user, "COMMENT_UPDATED", "Comentário " + commentId + " atualizado.");
        return mapper.toDto(commentRepository.save(comment));
    }

    @Transactional
    public void deleteComment(Long recordId, Long commentId) {
        User user = userService.authenticate();
        ChecklistComment comment = commentRepository.findByIdAndRecordId(commentId, recordId).orElseThrow(ResourceNotFoundException::new);
        if (!isAdministrator(user) && !comment.getAuthor().getId().equals(user.getId())) {
            throw new ForbiddenException("Somente o autor do comentário ou um administrador de checklist pode excluí-lo.");
        }
        comment.setActive(false);
        comment.setUpdatedAt(Instant.now());
        commentRepository.save(comment);
        addAudit(comment.getRecord(), user, "COMMENT_DELETED", "Comentário " + commentId + " excluído.");
    }

    @Transactional
    public ChecklistRecordDto delegate(Long recordId, Long userId) {
        User actor = userService.authenticate();
        assertAdministrator(actor);
        ChecklistRecord record = findRecord(recordId);
        if (!Set.of(ChecklistStatus.DRAFT, ChecklistStatus.IN_PROGRESS).contains(record.getStatus())) {
            throw new UnprocessableEntityException("Somente checklists editáveis podem ser delegados.");
        }
        User owner = userRepository.findById(userId).orElseThrow(ResourceNotFoundException::new);
        if (!owner.isEnabled() || !canOperate(record.getTemplate().getCategory(), owner)) {
            throw new UnprocessableEntityException("O usuário selecionado não pode operar esta categoria de checklist.");
        }
        record.setOwner(owner);
        record.setUpdatedAt(Instant.now());
        addAudit(record, actor, "DELEGATED", "Checklist delegado para " + owner.getName() + ".");
        return mapper.toDto(recordRepository.save(record));
    }

    @Transactional
    public ChecklistFlowDto updateOrder(Long recordId, ChecklistOrderUpdateDto input) {
        User actor = userService.authenticate();
        assertAdministrator(actor);
        ChecklistFlow flow = findRecord(recordId).getFlow();
        ErpOrderDto order = findErpOrder(input.getOrder());
        ErpOrderItemDto item = findCommercialItem(order, input.getItem());
        String previousOrder = flow.getOrderNumber();
        String previousClient = flow.getClientName();
        String previousItem = flow.getCommercialItem();
        flow.setOrderNumber(order.getNumber().toString());
        flow.setClientId(order.getCnpj());
        flow.setClientName(order.getClient());
        flow.setSalesperson(order.getSalesperson());
        flow.setCommercialItem(formatItem(item));
        flow.setUpdatedAt(Instant.now());
        flowRepository.save(flow);
        for (ChecklistRecord record : recordRepository.findByFlowId(flow.getId())) {
            addAudit(record, actor, "ORDER_UPDATED", "Pedido alterado de " + previousOrder + " para "
                    + flow.getOrderNumber() + "; cliente alterado de " + previousClient + " para " + flow.getClientName()
                    + "; item alterado de " + previousItem + " para " + flow.getCommercialItem() + ".");
        }
        return mapper.toDto(flow);
    }

    @Transactional
    public ChecklistFlowDto updateSerial(Long recordId, ChecklistSerialUpdateDto input) {
        User actor = userService.authenticate();
        assertAdministrator(actor);
        ChecklistFlow flow = findRecord(recordId).getFlow();
        if (flow.isCancelled()) throw new UnprocessableEntityException("Um fluxo de checklist cancelado não pode ser editado.");
        String serial = input.getSerial().trim();
        String normalized = normalizeSerial(serial);
        if (flowRepository.existsByNormalizedSerialAndIdNot(normalized, flow.getId())) {
            throw new UnprocessableEntityException("O número de série já pertence a outro fluxo de checklist.");
        }
        String previous = flow.getSerialNumber();
        flow.setSerialNumber(serial);
        flow.setNormalizedSerial(normalized);
        flow.setUpdatedAt(Instant.now());
        flowRepository.save(flow);
        for (ChecklistRecord record : recordRepository.findByFlowId(flow.getId())) {
            addAudit(record, actor, "SERIAL_UPDATED", "Número de série alterado de " + previous + " para " + serial + ".");
        }
        return mapper.toDto(flow);
    }

    private ChecklistFlow createFlow(ChecklistTemplate root, ChecklistRecordCreateDto input) {
        ChecklistFlow flow = new ChecklistFlow();
        applyCommercialData(flow, root.getCategory(), input);
        flow.setPlanJson(mapper.write(buildPlan(root)));
        flow.setSkippedJson("{}");
        flow.setCancelled(false);
        flow.setCreatedAt(Instant.now());
        flow.setUpdatedAt(flow.getCreatedAt());
        return flowRepository.save(flow);
    }

    private ChecklistFlow resolveManualSuccessorFlow(ChecklistTemplate template, Long predecessorRecordId, User user) {
        if (template.isAutomatic()) throw new UnprocessableEntityException("Sucessores automáticos não podem ser criados manualmente.");
        if (predecessorRecordId == null) throw new UnprocessableEntityException("É necessário informar o registro predecessor.");
        ChecklistRecord predecessor = findRecord(predecessorRecordId);
        assertVisible(predecessor, user);
        if (predecessor.getStatus() != ChecklistStatus.FINISHED || hasBlockingPredecessor(predecessor)) {
            throw new UnprocessableEntityException("O predecessor deve estar finalizado e desbloqueado.");
        }
        if (!Objects.equals(template.getPredecessor().getId(), predecessor.getTemplate().getId())) {
            throw new UnprocessableEntityException("O registro selecionado não é o predecessor deste modelo.");
        }
        if (recordRepository.existsByFlowIdAndTemplateId(predecessor.getFlow().getId(), template.getId())) {
            throw new UnprocessableEntityException("Esta etapa do fluxo já possui um registro de checklist.");
        }
        return predecessor.getFlow();
    }

    private List<ChecklistSnapshotDto> buildPlan(ChecklistTemplate root) {
        List<ChecklistSnapshotDto> plan = new ArrayList<>();
        Set<Long> visited = new HashSet<>();
        ChecklistTemplate cursor = root;
        while (cursor != null && visited.add(cursor.getId())) {
            ChecklistSnapshotDto snapshot = new ChecklistSnapshotDto();
            snapshot.setTemplate(mapper.toDto(cursor));
            snapshot.setCategory(mapper.toDto(cursor.getCategory()));
            snapshot.setEquipment(cursor.getEquipment() == null ? "" : cursor.getEquipment().getName());
            plan.add(snapshot);
            cursor = templateRepository.findByPredecessorId(cursor.getId()).orElse(null);
        }
        return plan;
    }

    private ChecklistRecord createEmptyRecord(ChecklistFlow flow, ChecklistTemplate template, User actor, boolean automatic) {
        ChecklistTemplateDto snapshotTemplate = snapshot(flow, template.getId()).getTemplate();
        Map<String, ChecklistAnswerDto> answers = new LinkedHashMap<>();
        for (ChecklistSectionDto section : snapshotTemplate.getSections()) {
            for (ChecklistQuestionDto question : section.getQuestions()) {
                ChecklistAnswerDto answer = new ChecklistAnswerDto();
                for (ChecklistFieldDto field : question.getFields()) {
                    answer.getFields().put(field.getId(), Objects.requireNonNullElse(field.getDefaultValue(), ""));
                }
                answers.put(question.getId(), answer);
            }
        }
        ChecklistRecord record = new ChecklistRecord();
        record.setFlow(flow);
        record.setTemplate(template);
        record.setCreator(actor);
        record.setOwner(automatic ? null : actor);
        record.setStatus(automatic ? ChecklistStatus.IN_PROGRESS : ChecklistStatus.DRAFT);
        record.setAutomatic(automatic);
        record.setAnswersJson(mapper.write(answers));
        Map<String, String> fields = new LinkedHashMap<>();
        for (ChecklistFieldDto field : snapshot(flow, template.getId()).getCategory().getFields()) {
            fields.put(field.getId(), Objects.requireNonNullElse(field.getDefaultValue(), ""));
        }
        record.setFieldsJson(mapper.write(fields));
        record.setDepartmentsJson("[]");
        record.setCreatedAt(Instant.now());
        record.setUpdatedAt(record.getCreatedAt());
        return record;
    }

    private void applyCommercialData(ChecklistFlow flow, ChecklistCategory category, ChecklistRecordCreateDto input) {
        String serial = trim(input.getSerial());
        if (category.isSerialRequired() && serial == null) throw new UnprocessableEntityException("É necessário informar o número de série.");
        String normalizedSerial = normalizeSerial(serial);
        if (normalizedSerial != null && flowRepository.findByNormalizedSerial(normalizedSerial).isPresent()) {
            throw new UnprocessableEntityException("O número de série já pertence a outro fluxo de checklist.");
        }
        ErpOrderDto order = null;
        ErpOrderItemDto item = null;
        if (category.isErpRequired()) {
            if (trim(input.getOrder()) == null || trim(input.getItem()) == null) {
                throw new UnprocessableEntityException("É necessário informar o pedido do ERP e o item comercial.");
            }
            order = findErpOrder(input.getOrder());
            item = findCommercialItem(order, input.getItem());
        }
        flow.setSerialNumber(serial);
        flow.setNormalizedSerial(normalizedSerial);
        flow.setOrderNumber(order == null ? trim(input.getOrder()) : order.getNumber().toString());
        flow.setClientId(order == null ? trim(input.getClientId()) : order.getCnpj());
        flow.setClientName(order == null ? trim(input.getClient()) : order.getClient());
        flow.setCommercialItem(item == null ? trim(input.getItem()) : formatItem(item));
        flow.setSalesperson(order == null ? trim(input.getSeller()) : order.getSalesperson());
    }

    private void validateCompletedRecord(ChecklistRecord record) {
        ChecklistSnapshotDto snapshot = snapshot(record.getFlow(), record.getTemplate().getId());
        Map<String, ChecklistAnswerDto> answers = readAnswers(record);
        Map<String, String> fields = mapper.read(record.getFieldsJson(), new TypeReference<>() {});
        List<String> departments = mapper.read(record.getDepartmentsJson(), new TypeReference<>() {});
        if (snapshot.getCategory().isSerial() && trim(record.getFlow().getSerialNumber()) == null) {
            throw new UnprocessableEntityException("É necessário informar o número de série.");
        }
        if (snapshot.getCategory().isErp() && (trim(record.getFlow().getOrderNumber()) == null
                || trim(record.getFlow().getClientId()) == null || trim(record.getFlow().getCommercialItem()) == null)) {
            throw new UnprocessableEntityException("A identificação do ERP está incompleta.");
        }
        if (snapshot.getCategory().isDepartments() && (departments == null || departments.isEmpty())) {
            throw new UnprocessableEntityException("É necessário informar pelo menos um departamento.");
        }
        for (ChecklistFieldDto field : snapshot.getCategory().getFields()) requireValue(fields.get(field.getId()), "É necessário preencher o campo da categoria.");
        Set<String> items = activeCatalogNames(ChecklistCatalogType.ITEM);
        Set<String> defects = activeCatalogNames(ChecklistCatalogType.DEFECT);
        for (ChecklistSectionDto section : snapshot.getTemplate().getSections()) {
            for (ChecklistQuestionDto question : section.getQuestions()) {
                ChecklistAnswerDto answer = answers.get(question.getId());
                if (answer == null || !section.getOptions().contains(answer.getValue())) {
                    throw new UnprocessableEntityException("Todas as perguntas do checklist precisam de uma resposta válida.");
                }
                if (!"N/A".equals(answer.getValue())) {
                    for (ChecklistFieldDto field : question.getFields()) requireValue(answer.getFields().get(field.getId()), "É necessário preencher o campo da pergunta.");
                }
                if ("NOK".equals(answer.getValue())) {
                    if (answer.getProblems() == null || answer.getProblems().isEmpty()) {
                        throw new UnprocessableEntityException("Toda resposta NOK precisa de pelo menos um problema.");
                    }
                    for (ChecklistProblemDto problem : answer.getProblems()) validateProblem(problem, items, defects);
                } else if (answer.getProblems() != null && !answer.getProblems().isEmpty()) {
                    throw new UnprocessableEntityException("Problemas são permitidos somente em respostas NOK.");
                }
            }
        }
    }

    private void validateProblem(ChecklistProblemDto problem, Set<String> items, Set<String> defects) {
        requireValue(problem.getId(), "É necessário informar o ID do problema.");
        requireValue(problem.getItem(), "É necessário informar o tipo de item do problema.");
        requireValue(problem.getCode(), "É necessário informar o código do item do problema.");
        requireValue(problem.getDefect(), "É necessário informar o defeito do problema.");
        requireValue(problem.getDescription(), "É necessário informar a descrição do problema.");
        requireValue(problem.getDepartment(), "É necessário informar o departamento do problema.");
        if (!items.contains(normalize(problem.getItem())) || !defects.contains(normalize(problem.getDefect()))) {
            throw new UnprocessableEntityException("O problema utiliza um item de catálogo inativo ou desconhecido.");
        }
    }

    private void advanceFlow(ChecklistRecord record, User actor) {
        if (record.getStatus() != ChecklistStatus.FINISHED || hasBlockingPredecessor(record)) return;
        ChecklistFlow flow = record.getFlow();
        List<ChecklistSnapshotDto> plan = plan(flow);
        Map<String, String> skipped = skipped(flow);
        int index = indexOf(plan, record.getTemplate().getId());
        for (int nextIndex = index + 1; nextIndex < plan.size(); nextIndex++) {
            ChecklistSnapshotDto next = plan.get(nextIndex);
            Long templateId = next.getTemplate().getId();
            if (recordRepository.existsByFlowIdAndTemplateId(flow.getId(), templateId)) return;
            if (skipped.containsKey(templateId.toString())) continue;
            ChecklistCategory currentCategory = categoryRepository.findById(next.getCategory().getId()).orElseThrow(ResourceNotFoundException::new);
            if (!currentCategory.isActive()) {
                skipped.put(templateId.toString(), Objects.requireNonNullElse(currentCategory.getDeactivationReason(), "Categoria inativa"));
                flow.setSkippedJson(mapper.write(skipped));
                flow.setUpdatedAt(Instant.now());
                flowRepository.save(flow);
                addAudit(record, actor, "CATEGORY_SKIPPED", currentCategory.getName() + ": " + skipped.get(templateId.toString()));
                continue;
            }
            if (next.getTemplate().isAutomatic()) {
                ChecklistTemplate template = templateRepository.findById(templateId).orElseThrow(ResourceNotFoundException::new);
                ChecklistRecord generated = createEmptyRecord(flow, template, actor, true);
                recordRepository.save(generated);
                addAudit(generated, null, "GENERATED", "Gerado automaticamente após a conclusão do predecessor.");
            }
            return;
        }
    }

    private void reconcileFlow(ChecklistFlow flow, User actor) {
        boolean changed;
        do {
            changed = false;
            for (ChecklistRecord record : recordRepository.findByFlowId(flow.getId())) {
                if (record.getStatus() == ChecklistStatus.PENDING && !hasUntreatedProblems(record) && !hasBlockingPredecessor(record)) {
                    record.setStatus(ChecklistStatus.FINISHED);
                    record.setFinishedAt(Instant.now());
                    record.setUpdatedAt(record.getFinishedAt());
                    recordRepository.save(record);
                    addAudit(record, actor, "FINISHED", "Finalizado após a liberação do predecessor e o tratamento dos problemas.");
                    advanceFlow(record, actor);
                    changed = true;
                }
            }
        } while (changed);
    }

    private boolean hasBlockingPredecessor(ChecklistRecord record) {
        List<ChecklistSnapshotDto> plan = plan(record.getFlow());
        Map<String, String> skipped = skipped(record.getFlow());
        int currentIndex = indexOf(plan, record.getTemplate().getId());
        for (int index = 0; index < currentIndex; index++) {
            Long templateId = plan.get(index).getTemplate().getId();
            if (skipped.containsKey(templateId.toString())) continue;
            ChecklistRecord predecessor = recordRepository.findByFlowIdAndTemplateId(record.getFlow().getId(), templateId).orElse(null);
            if (predecessor == null || predecessor.getStatus() != ChecklistStatus.FINISHED) return true;
        }
        return false;
    }

    private void assertNoBlockingPredecessor(ChecklistRecord record) {
        if (hasBlockingPredecessor(record)) {
            throw new UnprocessableEntityException("Um checklist anterior não está finalizado ou está em revisão.");
        }
    }

    private boolean hasUntreatedProblems(ChecklistRecord record) {
        return readAnswers(record).values().stream().flatMap(answer -> problems(answer).stream()).anyMatch(problem -> !problem.isTreated());
    }

    private boolean allProblemsTreated(Map<String, ChecklistAnswerDto> answers) {
        List<ChecklistProblemDto> problems = answers.values().stream().flatMap(answer -> problems(answer).stream()).toList();
        return !problems.isEmpty() && problems.stream().allMatch(ChecklistProblemDto::isTreated);
    }

    private ChecklistProblemDto findProblem(Map<String, ChecklistAnswerDto> answers, String problemId) {
        return answers.values().stream().flatMap(answer -> problems(answer).stream())
                .filter(problem -> Objects.equals(problem.getId(), problemId)).findFirst().orElseThrow(ResourceNotFoundException::new);
    }

    private ChecklistComment createComment(ChecklistRecord record, User author, String content, String problemId) {
        ChecklistComment comment = new ChecklistComment();
        comment.setRecord(record);
        comment.setAuthor(author);
        comment.setProblemId(problemId);
        comment.setContent(content);
        comment.setActive(true);
        comment.setCreatedAt(Instant.now());
        comment.setUpdatedAt(comment.getCreatedAt());
        return commentRepository.save(comment);
    }

    private void addAudit(ChecklistRecord record, User actor, String action, String details) {
        ChecklistAudit audit = new ChecklistAudit();
        audit.setRecord(record);
        audit.setActor(actor);
        audit.setActorName(actor == null ? "Sistema" : actor.getName());
        audit.setAction(action);
        audit.setDetails(details);
        audit.setCreatedAt(Instant.now());
        auditRepository.save(audit);
    }

    private ChecklistRecord findRecord(Long id) {
        return recordRepository.findDetailedById(id).orElseThrow(ResourceNotFoundException::new);
    }

    private void assertVisible(ChecklistRecord record, User user) {
        if (record.getStatus() == ChecklistStatus.DRAFT && !isAdministrator(user) && !record.getCreator().getId().equals(user.getId())) {
            throw new ResourceNotFoundException();
        }
    }

    private void assertEditable(ChecklistRecord record, User user) {
        assertVisible(record, user);
        if (!Set.of(ChecklistStatus.DRAFT, ChecklistStatus.IN_PROGRESS).contains(record.getStatus())) {
            throw new UnprocessableEntityException("O checklist não pode ser editado.");
        }
        assertCanOperate(record.getTemplate().getCategory(), user);
        if (!isAdministrator(user) && record.getOwner() != null && !record.getOwner().getId().equals(user.getId())) {
            throw new ForbiddenException("O checklist está atribuído a outro operador.");
        }
    }

    private void assertCanOperate(ChecklistCategory category, User user) {
        if (!canOperate(category, user)) throw new ForbiddenException("O usuário não pode operar esta categoria de checklist.");
    }

    private boolean canOperate(ChecklistCategory category, User user) {
        return isAdministrator(user) || user.hasRole("ROLE_CHECKLIST_OPERATOR")
                && categoryRepository.findAllowedCategoryIds(user.getId()).contains(category.getId());
    }

    private void assertAdministrator(User user) {
        if (!isAdministrator(user)) throw new ForbiddenException("É necessária a permissão de administrador de checklist.");
    }

    private boolean isAdministrator(User user) {
        return user.hasRole("ROLE_ADMIN") || user.hasRole("ROLE_CHECKLIST_ADMIN");
    }

    private ChecklistSnapshotDto snapshot(ChecklistFlow flow, Long templateId) {
        return plan(flow).stream().filter(item -> item.getTemplate().getId().equals(templateId))
                .findFirst().orElseThrow(ResourceNotFoundException::new);
    }

    private List<ChecklistSnapshotDto> plan(ChecklistFlow flow) {
        return mapper.read(flow.getPlanJson(), new TypeReference<>() {});
    }

    private Map<String, String> skipped(ChecklistFlow flow) {
        return mapper.read(flow.getSkippedJson(), new TypeReference<>() {});
    }

    private Map<String, ChecklistAnswerDto> readAnswers(ChecklistRecord record) {
        return mapper.read(record.getAnswersJson(), new TypeReference<>() {});
    }

    private int indexOf(List<ChecklistSnapshotDto> plan, Long templateId) {
        for (int index = 0; index < plan.size(); index++) {
            if (plan.get(index).getTemplate().getId().equals(templateId)) return index;
        }
        throw new ResourceNotFoundException();
    }

    private Set<String> activeCatalogNames(ChecklistCatalogType type) {
        Set<String> names = new HashSet<>();
        catalogRepository.findByTypeOrderByNameAsc(type).forEach(entry -> names.add(normalize(entry.getName())));
        return names;
    }

    private void validateTreatmentIntegrity(Map<String, ChecklistAnswerDto> previous,
                                            Map<String, ChecklistAnswerDto> submitted) {
        Map<String, ChecklistProblemDto> existingProblems = new HashMap<>();
        previous.values().forEach(answer -> problems(answer).forEach(problem -> existingProblems.put(problem.getId(), problem)));
        submitted.values().forEach(answer -> problems(answer).forEach(problem -> {
            ChecklistProblemDto existing = existingProblems.get(problem.getId());
            if (existing == null && (problem.isTreated() || problem.getCommentId() != null)
                    || existing != null && (existing.isTreated() != problem.isTreated()
                    || !Objects.equals(existing.getCommentId(), problem.getCommentId()))) {
                throw new UnprocessableEntityException("O tratamento do problema só pode ser alterado pela ação de tratamento.");
            }
        }));
    }

    private List<ChecklistProblemDto> problems(ChecklistAnswerDto answer) {
        return answer.getProblems() == null ? List.of() : answer.getProblems();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String normalizeSerial(String value) {
        return value == null ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private ErpOrderDto findErpOrder(String orderNumber) {
        try {
            int number = Integer.parseInt(orderNumber.trim());
            return erpOrderQueryService.findProductionOrderByNumber(number, ErpSource.FOCCO)
                    .orElseThrow(ResourceNotFoundException::new);
        } catch (NumberFormatException exception) {
            throw new UnprocessableEntityException("O número do pedido do ERP é inválido.");
        }
    }

    private ErpOrderItemDto findCommercialItem(ErpOrderDto order, String selectedItem) {
        String selected = normalize(selectedItem);
        return order.getItems().stream()
                .filter(item -> selected.equals(normalize(item.getCode())) || selected.equals(normalize(formatItem(item))))
                .findFirst().orElseThrow(() -> new UnprocessableEntityException("O item comercial não pertence ao pedido do ERP selecionado."));
    }

    private String formatItem(ErpOrderItemDto item) {
        return item.getCode() + " - " + item.getDescription();
    }

    private void requireValue(String value, String message) {
        if (value == null || value.isBlank()) throw new UnprocessableEntityException(message);
    }

    private String trim(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private <T> T nonNull(T value, T fallback) {
        return value == null ? fallback : value;
    }
}

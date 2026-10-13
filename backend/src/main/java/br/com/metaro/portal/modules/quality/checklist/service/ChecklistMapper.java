package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@RequiredArgsConstructor
public class ChecklistMapper {
    private final ObjectMapper objectMapper;
    private final ChecklistCommentRepository commentRepository;
    private final ChecklistAuditRepository auditRepository;
    private final ChecklistRevisionRepository revisionRepository;
    private final ChecklistEvidenceService evidenceService;

    public ChecklistCategoryDto toDto(ChecklistCategory entity) {
        ChecklistCategoryDto dto = new ChecklistCategoryDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setIntegration(entity.getIntegration() == ChecklistIntegration.FIVE_S
                ? "5s"
                : entity.getIntegration().name().toLowerCase(Locale.ROOT));
        dto.setActive(entity.isActive());
        dto.setReason(entity.getDeactivationReason());
        dto.setDisplayOrder(entity.getDisplayOrder());
        dto.setLogo(entity.isLogo());
        dto.setRe(entity.getReLabel());
        dto.setRef(entity.getReferenceLabel());
        dto.setDocumentTitle(entity.getDocumentTitle());
        dto.setClientNokHistory(entity.isClientNokHistory());
        dto.setDates(entity.isDates());
        dto.setDepartments(entity.isDepartments());
        dto.setSerial(entity.isSerialRequired());
        dto.setErp(entity.isErpRequired());
        dto.setFields(read(entity.getFieldsJson(), new TypeReference<>() {}));
        dto.setOperators(entity.getOperators().stream().map(User::getId).sorted().toList());
        return dto;
    }

    public ChecklistEquipmentDto toDto(ChecklistEquipment entity) {
        ChecklistEquipmentDto dto = new ChecklistEquipmentDto();
        dto.setId(entity.getId());
        dto.setName(entity.getName());
        dto.setAbbreviation(entity.getAbbreviation());
        return dto;
    }

    public ChecklistTemplateDto toDto(ChecklistTemplate entity) {
        ChecklistTemplateDto dto = new ChecklistTemplateDto();
        dto.setId(entity.getId());
        dto.setCategoryId(entity.getCategory().getId());
        dto.setName(entity.getName());
        dto.setEquipmentId(entity.getEquipment() == null ? null : entity.getEquipment().getId());
        dto.setTitle(entity.getTitleExpression());
        dto.setSections(read(entity.getSectionsJson(), new TypeReference<>() {}));
        dto.setSignature(entity.isSignature());
        dto.setPredecessorId(entity.getPredecessor() == null ? null : entity.getPredecessor().getId());
        dto.setAutomatic(entity.isAutomatic());
        dto.setVersion(entity.getVersion());
        dto.setDisplayOrder(entity.getDisplayOrder());
        return dto;
    }

    public ChecklistFlowDto toDto(ChecklistFlow entity) {
        ChecklistFlowDto dto = new ChecklistFlowDto();
        dto.setId(entity.getId());
        dto.setSerial(entity.getSerialNumber());
        dto.setOrder(entity.getOrderNumber());
        dto.setClientId(entity.getClientId());
        dto.setClient(entity.getClientName());
        dto.setItem(entity.getCommercialItem());
        dto.setSeller(entity.getSalesperson());
        dto.setPlan(read(entity.getPlanJson(), new TypeReference<>() {}));
        dto.setSkipped(read(entity.getSkippedJson(), new TypeReference<>() {}));
        dto.setCancelled(entity.isCancelled());
        dto.setCancellationReason(entity.getCancellationReason());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        return dto;
    }

    public ChecklistRecordDto toDto(ChecklistRecord entity) {
        ChecklistRecordDto dto = new ChecklistRecordDto();
        dto.setId(entity.getId());
        dto.setFlowId(entity.getFlow().getId());
        dto.setTemplateId(entity.getTemplate().getId());
        dto.setCreatorId(entity.getCreator().getId());
        dto.setOwnerId(entity.getOwner() == null ? null : entity.getOwner().getId());
        dto.setOwner(entity.getOwner() == null ? "" : entity.getOwner().getName());
        dto.setFinisherId(entity.getFinisher() == null ? null : entity.getFinisher().getId());
        dto.setSignature(entity.getSignature());
        dto.setSignedAt(entity.getSignedAt());
        dto.setCreated(entity.getCreatedAt());
        dto.setUpdated(entity.getUpdatedAt());
        dto.setFinished(entity.getFinishedAt());
        dto.setStatus(entity.getStatus().name());
        dto.setAutomatic(entity.isAutomatic());
        Map<String, ChecklistAnswerDto> answers = read(entity.getAnswersJson(), new TypeReference<>() {});
        Map<String, List<ChecklistEvidenceDto>> evidenceByProblem = new HashMap<>();
        evidenceService.findByRecord(entity.getId()).forEach(evidence -> evidenceByProblem
                .computeIfAbsent(evidence.getProblemId(), ignored -> new ArrayList<>())
                .add(evidenceService.toDto(evidence)));
        answers.values().stream()
                .filter(answer -> answer.getProblems() != null)
                .flatMap(answer -> answer.getProblems().stream())
                .forEach(problem -> problem.setMedia(evidenceByProblem.getOrDefault(problem.getId(), List.of())));
        dto.setAnswers(answers);
        dto.setFields(read(entity.getFieldsJson(), new TypeReference<>() {}));
        dto.setDepartments(read(entity.getDepartmentsJson(), new TypeReference<>() {}));
        dto.setComments(commentRepository.findByRecordIdAndActiveTrueOrderByCreatedAtAsc(entity.getId()).stream().map(this::toDto).toList());
        dto.setLogs(auditRepository.findByRecordIdOrderByCreatedAtAsc(entity.getId()).stream().map(this::toDto).toList());
        dto.setRevisions(revisionRepository.findByRecordIdOrderByCreatedAtAsc(entity.getId()).stream().map(this::toDto).toList());
        dto.setVersion(entity.getLockVersion());
        return dto;
    }

    public ChecklistCommentDto toDto(ChecklistComment entity) {
        ChecklistCommentDto dto = new ChecklistCommentDto();
        dto.setId(entity.getId());
        dto.setAuthorId(entity.getAuthor().getId());
        dto.setAuthor(entity.getAuthor().getName());
        dto.setAt(entity.getCreatedAt());
        dto.setText(entity.getContent());
        dto.setProblemId(entity.getProblemId());
        return dto;
    }

    public ChecklistAuditDto toDto(ChecklistAudit entity) {
        ChecklistAuditDto dto = new ChecklistAuditDto();
        dto.setId(entity.getId());
        dto.setAt(entity.getCreatedAt());
        dto.setActor(entity.getActorName());
        dto.setAction(entity.getAction());
        dto.setDetails(entity.getDetails());
        return dto;
    }

    public ChecklistRevisionDto toDto(ChecklistRevision entity) {
        ChecklistRevisionDto dto = new ChecklistRevisionDto();
        dto.setId(entity.getId());
        dto.setAt(entity.getCreatedAt());
        dto.setActor(entity.getCreatedBy().getName());
        dto.setReason(entity.getReason());
        dto.setRecord(readTree(entity.getSnapshotJson()));
        return dto;
    }

    public ChecklistCatalogEntryDto toDto(ChecklistCatalogEntry entity) {
        ChecklistCatalogEntryDto dto = new ChecklistCatalogEntryDto();
        dto.setId(entity.getId());
        dto.setType(entity.getType().name());
        dto.setName(entity.getName());
        dto.setActive(entity.isActive());
        dto.setCreatedBy(entity.getCreatedBy() == null ? null : entity.getCreatedBy().getId());
        dto.setCreatedAt(entity.getCreatedAt());
        return dto;
    }

    public String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Não foi possível serializar os dados do checklist.", exception);
        }
    }

    public <T> T read(String value, TypeReference<T> type) {
        try {
            return objectMapper.readValue(value == null || value.isBlank() ? "null" : value, type);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Não foi possível desserializar os dados do checklist.", exception);
        }
    }

    public JsonNode readTree(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Não foi possível desserializar a revisão do checklist.", exception);
        }
    }
}

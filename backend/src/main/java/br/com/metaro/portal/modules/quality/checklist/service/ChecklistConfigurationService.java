package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.UserRepository;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChecklistConfigurationService {
    private final ChecklistCategoryRepository categoryRepository;
    private final ChecklistEquipmentRepository equipmentRepository;
    private final ChecklistTemplateRepository templateRepository;
    private final ChecklistRecordRepository recordRepository;
    private final ChecklistCatalogEntryRepository catalogRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final ChecklistMapper mapper;
    private final ChecklistStepFlowService checklistStepFlowService;

    @Transactional(readOnly = true)
    public List<ChecklistCategoryDto> listCategories() {
        return categoryRepository.findAll(Sort.by(Sort.Direction.ASC, "id")).stream().map(mapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<ChecklistOperatorDto> listOperators() {
        return userRepository.findAll(Sort.by("name")).stream()
                .filter(user -> user.hasRole("ROLE_CHECKLIST_OPERATOR"))
                .map(user -> new ChecklistOperatorDto(user.getId(), user.getName(), Boolean.TRUE.equals(user.getActivated())))
                .toList();
    }

    @Transactional
    public ChecklistCategoryDto saveCategory(ChecklistCategoryDto dto) {
        Long id = dto.getId();
        boolean duplicateName = id == null
                ? categoryRepository.existsByNameIgnoreCase(dto.getName().trim())
                : categoryRepository.existsByNameIgnoreCaseAndIdNot(dto.getName().trim(), id);
        if (duplicateName) {
            throw new UnprocessableEntityException("Já existe uma categoria de checklist com este nome.");
        }
        ChecklistCategory entity = dto.getId() == null ? new ChecklistCategory()
                : categoryRepository.findById(dto.getId()).orElseThrow(ResourceNotFoundException::new);
        Instant now = Instant.now();
        if (entity.getId() == null) {
            entity.setCreatedAt(now);
        }
        ChecklistIntegration previousIntegration = entity.getIntegration();
        entity.setName(dto.getName().trim());
        entity.setIntegration(parseIntegration(dto.getIntegration()));
        entity.setActive(dto.isActive());
        entity.setDeactivationReason(blankToNull(dto.getReason()));
        if (!entity.isActive() && entity.getDeactivationReason() == null) {
            throw new UnprocessableEntityException("É necessário informar uma justificativa para desativar a categoria.");
        }
        if (!entity.isActive() && checklistStepFlowService.categoryIsRequired(entity.getId())) {
            throw new UnprocessableEntityException("Uma categoria exigida pelo Fluxo de etapas não pode ser desativada.");
        }
        entity.setDisplayOrder(dto.getDisplayOrder());
        entity.setLogo(dto.isLogo());
        entity.setReLabel(blankToNull(dto.getRe()));
        entity.setReferenceLabel(blankToNull(dto.getRef()));
        entity.setDocumentTitle(requireText(dto.getDocumentTitle(), "É necessário informar o título do documento."));
        entity.setClientNokHistory(dto.isClientNokHistory());
        entity.setDates(dto.isDates());
        entity.setDepartments(dto.isDepartments());
        entity.setSerialRequired(entity.getIntegration() == ChecklistIntegration.PRODUCTION || dto.isSerial());
        entity.setErpRequired(entity.getIntegration() == ChecklistIntegration.PRODUCTION || dto.isErp());
        validateFields(dto.getFields());
        entity.setFieldsJson(mapper.write(dto.getFields()));
        entity.setUpdatedAt(now);
        if (previousIntegration != null && previousIntegration != entity.getIntegration()) {
            applyIntegrationChange(entity);
        }
        return mapper.toDto(categoryRepository.save(entity));
    }

    @Transactional
    public void deleteCategory(Long id) {
        if (templateRepository.existsByCategoryId(id)) {
            throw new UnprocessableEntityException("Uma categoria que possui modelos não pode ser excluída.");
        }
        ChecklistCategory entity = categoryRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        categoryRepository.delete(entity);
    }

    @Transactional
    public void updateCategoryAccess(ChecklistAccessUpdateDto dto) {
        ChecklistCategory category = categoryRepository.findById(dto.getCategoryId()).orElseThrow(ResourceNotFoundException::new);
        Set<User> operators = new HashSet<>(userRepository.findAllById(dto.getUserIds()));
        if (operators.size() != new HashSet<>(dto.getUserIds()).size()) {
            throw new ResourceNotFoundException();
        }
        category.setOperators(operators);
        category.setUpdatedAt(Instant.now());
        categoryRepository.save(category);
    }

    @Transactional(readOnly = true)
    public List<Long> myCategoryAccess() {
        User user = userService.authenticate();
        if (isAdministrator(user)) {
            return categoryRepository.findAll().stream().map(ChecklistCategory::getId).toList();
        }
        return categoryRepository.findAllowedCategoryIds(user.getId());
    }

    @Transactional(readOnly = true)
    public List<ChecklistEquipmentDto> listEquipment() {
        return equipmentRepository.findAll(Sort.by("abbreviation")).stream().map(mapper::toDto).toList();
    }

    @Transactional
    public ChecklistEquipmentDto saveEquipment(ChecklistEquipmentDto dto) {
        Long id = dto.getId();
        String abbreviation = requireText(dto.getAbbreviation(), "É necessário informar a abreviação do equipamento.").toUpperCase(Locale.ROOT);
        boolean duplicateAbbreviation = id == null
                ? equipmentRepository.existsByAbbreviationIgnoreCase(abbreviation)
                : equipmentRepository.existsByAbbreviationIgnoreCaseAndIdNot(abbreviation, id);
        if (duplicateAbbreviation) {
            throw new UnprocessableEntityException("Já existe um equipamento com esta abreviação.");
        }
        ChecklistEquipment entity = dto.getId() == null ? new ChecklistEquipment()
                : equipmentRepository.findById(dto.getId()).orElseThrow(ResourceNotFoundException::new);
        Instant now = Instant.now();
        if (entity.getId() == null) {
            entity.setCreatedAt(now);
        }
        entity.setAbbreviation(abbreviation);
        entity.setName(requireText(dto.getName(), "É necessário informar o nome do equipamento."));
        entity.setUpdatedAt(now);
        return mapper.toDto(equipmentRepository.save(entity));
    }

    @Transactional
    public void deleteEquipment(Long id) {
        if (templateRepository.existsByEquipmentId(id)) {
            throw new UnprocessableEntityException("Um equipamento utilizado por um modelo não pode ser excluído.");
        }
        equipmentRepository.delete(equipmentRepository.findById(id).orElseThrow(ResourceNotFoundException::new));
    }

    @Transactional(readOnly = true)
    public List<ChecklistTemplateDto> listTemplates() {
        return templateRepository.findAllByOrderByDisplayOrderAscNameAsc().stream().map(mapper::toDto).toList();
    }

    @Transactional
    public ChecklistTemplateDto saveTemplate(ChecklistTemplateDto dto) {
        Long id = dto.getId();
        ChecklistCategory category = categoryRepository.findById(dto.getCategoryId()).orElseThrow(ResourceNotFoundException::new);
        ChecklistTemplate entity = dto.getId() == null ? new ChecklistTemplate()
                : templateRepository.findById(dto.getId()).orElseThrow(ResourceNotFoundException::new);
        ChecklistEquipment equipment = dto.getEquipmentId() == null ? null
                : equipmentRepository.findById(dto.getEquipmentId()).orElseThrow(ResourceNotFoundException::new);
        ChecklistTemplate predecessor = dto.getPredecessorId() == null ? null
                : templateRepository.findById(dto.getPredecessorId()).orElseThrow(ResourceNotFoundException::new);
        validateTemplate(dto, id, category, equipment, predecessor);
        Instant now = Instant.now();
        if (entity.getId() == null) {
            entity.setCreatedAt(now);
            entity.setVersion(1);
        } else {
            entity.setVersion(entity.getVersion() + 1);
        }
        entity.setCategory(category);
        entity.setEquipment(equipment);
        entity.setPredecessor(predecessor);
        entity.setName(category.getIntegration() == ChecklistIntegration.PRODUCTION ? equipment.getAbbreviation() : dto.getName().trim());
        entity.setTitleExpression(dto.getTitle().trim());
        entity.setSectionsJson(mapper.write(dto.getSections()));
        entity.setSignature(category.getIntegration() == ChecklistIntegration.PRODUCTION || dto.isSignature());
        entity.setAutomatic(predecessor != null && dto.isAutomatic());
        entity.setDisplayOrder(dto.getDisplayOrder());
        entity.setUpdatedAt(now);
        return mapper.toDto(templateRepository.save(entity));
    }

    @Transactional(readOnly = true)
    public ChecklistTemplateDto copyTemplate(Long id) {
        ChecklistTemplate source = templateRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        ChecklistTemplateDto copy = mapper.toDto(source);
        copy.setId(null);
        copy.setName(source.getName() + " - cópia");
        copy.setEquipmentId(null);
        copy.setPredecessorId(null);
        copy.setAutomatic(false);
        copy.setVersion(0);
        copy.setDisplayOrder(source.getDisplayOrder() + 1);
        return copy;
    }

    @Transactional
    public void deleteTemplate(Long id) {
        ChecklistTemplate entity = templateRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        if (recordRepository.existsByTemplateId(id) || templateRepository.findByPredecessorId(id).isPresent()) {
            throw new UnprocessableEntityException("Um modelo utilizado ou referenciado não pode ser excluído.");
        }
        templateRepository.delete(entity);
    }

    @Transactional(readOnly = true)
    public List<ChecklistCatalogEntryDto> listCatalog(ChecklistCatalogType type) {
        return catalogRepository.findByTypeAndActiveTrueOrderByNameAsc(type).stream().map(mapper::toDto).toList();
    }

    @Transactional
    public ChecklistCatalogEntryDto saveCatalogEntry(ChecklistCatalogEntryDto dto) {
        User user = userService.authenticate();
        ChecklistCatalogType type = parseCatalogType(dto.getType());
        if (type == ChecklistCatalogType.DEFECT && !isAdministrator(user)) {
            throw new br.com.metaro.portal.core.services.exceptions.ForbiddenException("Somente administradores de checklist podem gerenciar defeitos.");
        }
        Long id = dto.getId() == null ? 0L : dto.getId();
        String name = normalizeDisplayName(dto.getName(), type);
        String normalized = normalizeName(name);
        if (catalogRepository.existsByTypeAndNormalizedNameAndIdNot(type, normalized, id)) {
            throw new UnprocessableEntityException("Este item já existe no catálogo.");
        }
        ChecklistCatalogEntry entity = dto.getId() == null ? new ChecklistCatalogEntry()
                : catalogRepository.findById(dto.getId()).orElseThrow(ResourceNotFoundException::new);
        if (entity.getId() == null) {
            entity.setType(type);
            entity.setCreatedBy(user);
            entity.setCreatedAt(Instant.now());
        } else if (entity.getType() != type) {
            throw new UnprocessableEntityException("O tipo do item do catálogo não pode ser alterado.");
        }
        entity.setName(name);
        entity.setNormalizedName(normalized);
        entity.setActive(dto.isActive());
        entity.setUpdatedAt(Instant.now());
        return mapper.toDto(catalogRepository.save(entity));
    }

    private void validateTemplate(ChecklistTemplateDto dto, Long id, ChecklistCategory category,
                                  ChecklistEquipment equipment, ChecklistTemplate predecessor) {
        if (dto.getSections() == null || dto.getSections().isEmpty()) {
            throw new UnprocessableEntityException("É necessário informar pelo menos uma seção.");
        }
        for (ChecklistSectionDto section : dto.getSections()) {
            if (section.getName() == null || section.getName().isBlank() || section.getQuestions() == null
                    || section.getQuestions().isEmpty() || section.getOptions() == null || section.getOptions().isEmpty()) {
                throw new UnprocessableEntityException("Todas as seções precisam de nome, opções e perguntas.");
            }
            if (new HashSet<>(section.getOptions()).size() != section.getOptions().size()) {
                throw new UnprocessableEntityException("As opções da seção não podem ser duplicadas.");
            }
            boolean hasNok = section.getOptions().contains("NOK");
            if (!section.getOptions().contains("N/A")) {
                throw new UnprocessableEntityException("A opção N/A é obrigatória em todas as seções.");
            }
            if ((category.getIntegration() == ChecklistIntegration.PRODUCTION) != hasNok) {
                throw new UnprocessableEntityException("A opção NOK é obrigatória somente para categorias de produção.");
            }
            if (section.getQuestions().stream().anyMatch(question -> question.getLabel() == null || question.getLabel().isBlank())) {
                throw new UnprocessableEntityException("Todas as perguntas precisam de uma descrição.");
            }
            section.getQuestions().forEach(question -> validateFields(question.getFields()));
        }
        if (category.getIntegration() == ChecklistIntegration.PRODUCTION) {
            if (equipment == null) throw new UnprocessableEntityException("Modelos de produção precisam de um equipamento.");
            boolean equipmentAlreadyConfigured = id == null
                    ? templateRepository.existsByCategoryIdAndEquipmentId(category.getId(), equipment.getId())
                    : templateRepository.existsByCategoryIdAndEquipmentIdAndIdNot(category.getId(), equipment.getId(), id);
            if (equipmentAlreadyConfigured) {
                throw new UnprocessableEntityException("O equipamento já possui um modelo nesta categoria.");
            }
        } else if (dto.getName() == null || dto.getName().isBlank()) {
            throw new UnprocessableEntityException("É necessário informar o nome do modelo.");
        }
        if (predecessor != null) validatePredecessor(id, category, equipment, predecessor);
    }

    private void validatePredecessor(Long id, ChecklistCategory category, ChecklistEquipment equipment,
                                     ChecklistTemplate predecessor) {
        if (predecessor.getId().equals(id) || predecessor.getCategory().getId().equals(category.getId())) {
            throw new UnprocessableEntityException("O predecessor deve pertencer a outra categoria.");
        }
        boolean predecessorAlreadyUsed = id == null
                ? templateRepository.existsByPredecessorId(predecessor.getId())
                : templateRepository.existsByPredecessorIdAndIdNot(predecessor.getId(), id);
        if (predecessorAlreadyUsed) {
            throw new UnprocessableEntityException("Um predecessor pode possuir somente um sucessor.");
        }
        boolean production = category.getIntegration() == ChecklistIntegration.PRODUCTION;
        if (category.getIntegration() != predecessor.getCategory().getIntegration()) {
            throw new UnprocessableEntityException("As dependências do checklist devem usar o mesmo tipo de integração.");
        }
        if (production && !Objects.equals(equipment.getId(), predecessor.getEquipment().getId())) {
            throw new UnprocessableEntityException("Os modelos do fluxo de produção devem usar o mesmo equipamento.");
        }
        Set<Long> visited = new HashSet<>();
        visited.add(id);
        ChecklistTemplate cursor = predecessor;
        while (cursor != null) {
            if (!visited.add(cursor.getId())) throw new UnprocessableEntityException("A dependência do modelo cria um ciclo.");
            cursor = cursor.getPredecessor();
        }
    }

    private void validateFields(List<ChecklistFieldDto> fields) {
        if (fields == null) return;
        Set<String> ids = new HashSet<>();
        for (ChecklistFieldDto field : fields) {
            if (field.getId() == null || field.getId().isBlank() || field.getLabel() == null || field.getLabel().isBlank()) {
                throw new UnprocessableEntityException("Os campos configurados precisam de identificadores estáveis e descrições.");
            }
            if (!ids.add(field.getId())) throw new UnprocessableEntityException("Os identificadores dos campos configurados devem ser únicos.");
            if ("select".equals(field.getType()) && (field.getOptions() == null || field.getOptions().isEmpty())) {
                throw new UnprocessableEntityException("Campos de seleção precisam de opções.");
            }
        }
    }

    private void applyIntegrationChange(ChecklistCategory category) {
        for (ChecklistTemplate template : templateRepository.findAllByOrderByDisplayOrderAscNameAsc()) {
            if (!template.getCategory().getId().equals(category.getId())) continue;
            List<ChecklistSectionDto> sections = mapper.read(template.getSectionsJson(), new com.fasterxml.jackson.core.type.TypeReference<>() {});
            for (ChecklistSectionDto section : sections) {
                section.getOptions().removeIf("NOK"::equals);
                if (category.getIntegration() == ChecklistIntegration.PRODUCTION) section.getOptions().add("NOK");
            }
            template.setSectionsJson(mapper.write(sections));
            template.setEquipment(null);
            template.setSignature(category.getIntegration() == ChecklistIntegration.PRODUCTION);
            template.setVersion(template.getVersion() + 1);
            template.setUpdatedAt(Instant.now());
            templateRepository.save(template);
        }
    }

    private ChecklistIntegration parseIntegration(String value) {
        if (value == null) throw new UnprocessableEntityException("É necessário informar o tipo de integração.");
        return switch (value.trim().toUpperCase(Locale.ROOT)) {
            case "PRODUCTION" -> ChecklistIntegration.PRODUCTION;
            case "5S", "FIVE_S" -> ChecklistIntegration.FIVE_S;
            case "NONE" -> ChecklistIntegration.NONE;
            default -> throw new UnprocessableEntityException("Tipo de integração de checklist não suportado.");
        };
    }

    private ChecklistCatalogType parseCatalogType(String value) {
        try {
            return ChecklistCatalogType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException exception) {
            throw new UnprocessableEntityException("Tipo de catálogo de checklist não suportado.");
        }
    }

    private String normalizeDisplayName(String value, ChecklistCatalogType type) {
        String normalized = requireText(value, "É necessário informar o nome do item do catálogo.").replaceAll("\\s+", " ");
        if (type == ChecklistCatalogType.ITEM) {
            return normalized.substring(0, 1).toUpperCase(Locale.ROOT) + normalized.substring(1).toLowerCase(Locale.ROOT);
        }
        return normalized;
    }

    private String normalizeName(String value) {
        return value.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) throw new UnprocessableEntityException(message);
        return value.trim();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private boolean isAdministrator(User user) {
        return user.hasRole("ROLE_ADMIN") || user.hasRole("ROLE_CHECKLIST_ADMIN");
    }
}

package br.com.metaro.portal.modules.general.memorando.service;

import br.com.metaro.portal.core.entities.NotificationType;
import br.com.metaro.portal.core.entities.Position;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.PositionRepository;
import br.com.metaro.portal.core.services.NotificationService;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ForbiddenException;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoDto;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoIgnoreDto;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoInsertDto;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoListDto;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoNavigationDto;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoSummaryDto;
import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus;
import br.com.metaro.portal.modules.general.memorando.entity.Signature;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoRepository;
import br.com.metaro.portal.modules.general.memorando.util.MemorandoUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
public class MemorandoService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final List<String> ALLOWED_SORTS = List.of("number", "request", "client", "status", "createAt");

    @Value("${spring.datasource.driver-class-name:}")
    private String datasourceDriver;
    @Autowired
    private MemorandoUtil util;
    @Autowired
    private MemorandoRepository memorandoRepository;
    @Autowired
    private MemorandoLogService logService;
    @Autowired
    private UserService userService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private PositionRepository positionRepository;

    @Transactional(readOnly = true)
    public Page<MemorandoListDto> listMemorandos(
            Pageable requestedPageable,
            String group,
            String status,
            String search,
            boolean fullText
    ) {
        User me = userService.authenticate();
        boolean admin = isAdmin(me);
        boolean draft = parseDraftGroup(group);
        MemorandoStatus statusFilter = parseStatus(status, draft);
        String normalizedSearch = search == null ? "" : search.trim();
        Pageable pageable = sanitizePageable(requestedPageable);

        Page<Memorando> entities;
        if (fullText && !normalizedSearch.isBlank() && isPostgres()) {
            Pageable relevancePageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize());
            entities = memorandoRepository.searchFullText(
                    relevancePageable,
                    normalizedSearch,
                    draft,
                    statusFilter == null ? "" : statusFilter.name(),
                    admin,
                    me.getId()
            );
        } else if (fullText && !normalizedSearch.isBlank()) {
            entities = memorandoRepository.searchExtended(
                    pageable, normalizedSearch, draft, statusFilter, admin, me.getId()
            );
        } else {
            entities = memorandoRepository.search(pageable, normalizedSearch, draft, statusFilter, admin, me.getId());
        }

        return entities.map(MemorandoListDto::new);
    }

    @Transactional(readOnly = true)
    public MemorandoSummaryDto getSummary() {
        User me = userService.authenticate();
        return new MemorandoSummaryDto(
                memorandoRepository.findSummary(isAdmin(me), me.getId())
        );
    }

    private boolean isAdmin(User user) {
        return user.getRoles().stream().anyMatch(role -> role.getAuthority().equals("ROLE_ADMIN"));
    }

    private boolean parseDraftGroup(String group) {
        if (group == null || group.isBlank() || group.equalsIgnoreCase("PUBLISHED")) return false;
        if (group.equalsIgnoreCase("DRAFT")) return true;
        throw new UnprocessableEntityException("Grupo de memorandos inválido!");
    }

    private MemorandoStatus parseStatus(String status, boolean draft) {
        if (status == null || status.isBlank()) return null;

        try {
            MemorandoStatus parsed = MemorandoStatus.valueOf(status.toUpperCase());
            if (draft && parsed != MemorandoStatus.CREATED) {
                throw new UnprocessableEntityException("O status informado não pertence aos rascunhos!");
            }
            if (!draft && parsed == MemorandoStatus.CREATED) {
                throw new UnprocessableEntityException("O status informado não pertence aos publicados!");
            }
            return parsed;
        } catch (IllegalArgumentException exception) {
            throw new UnprocessableEntityException("Status de memorando inválido!");
        }
    }

    private Pageable sanitizePageable(Pageable pageable) {
        int size = Math.clamp(pageable.getPageSize(), 1, MAX_PAGE_SIZE);
        Sort sort = Sort.by(pageable.getSort().stream()
                .filter(order -> ALLOWED_SORTS.contains(order.getProperty()))
                .toList());

        if (sort.isUnsorted()) {
            sort = Sort.by(Sort.Order.desc("createAt"), Sort.Order.desc("id"));
        }
        return PageRequest.of(Math.max(pageable.getPageNumber(), 0), size, sort);
    }

    private boolean isPostgres() {
        return datasourceDriver.toLowerCase().contains("postgresql");
    }

    @Transactional(readOnly = true)
    public MemorandoDto getMemorando(Long id) {
        Memorando entity = memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        User me = userService.authenticate();

        validateReadAccess(entity, me);

        return new MemorandoDto(entity);
    }

    @Transactional(readOnly = true)
    public MemorandoNavigationDto getNavigation(Long id) {
        Memorando entity = memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        User me = userService.authenticate();
        validateReadAccess(entity, me);

        boolean draft = entity.getStatus().equals(MemorandoStatus.CREATED);
        Pageable firstResult = PageRequest.of(0, 1);
        List<Long> previous = memorandoRepository.findPreviousAccessibleId(
                id, draft, isAdmin(me), me.getId(), firstResult
        );
        List<Long> next = memorandoRepository.findNextAccessibleId(
                id, draft, isAdmin(me), me.getId(), firstResult
        );

        return new MemorandoNavigationDto(
                previous.isEmpty() ? null : previous.getFirst(),
                next.isEmpty() ? null : next.getFirst()
        );
    }

    private void validateReadAccess(Memorando entity, User user) {
        if (
            entity.getStatus().equals(MemorandoStatus.CREATED)
            && !entity.getCreatedBy().getId().equals(user.getId())
            && !isAdmin(user)
        ) {
            throw new ForbiddenException("Você não tem permissões para acessar esse recurso!");
        }
    }

    @CacheEvict(value = "homeInfo", allEntries = true)
    @Transactional
    public MemorandoDto createMemorando(MemorandoInsertDto dto) {
        User me = userService.authenticate();

        if (
            dto.getDepartments().size() == 1 &&
            dto.getDepartments().getFirst().equals(me.getPosition().getId())
        ) {
            throw new UnprocessableEntityException("É necessário ao menos 2 departamentos para continuar!");
        }

        Memorando entity = new Memorando();

        util.dtoToEntity(dto, entity);
        util.checkIfAllDepartmentsAreActive(entity);

        entity.setCreatedBy(me);
        entity.setSignatures(new ArrayList<>());
        entity.setLogs(new ArrayList<>());

        util.addMyDepartment(entity);

        if (entity.getStatus().equals(MemorandoStatus.PUBLISH)) util.addAllSignatures(entity);

        entity = memorandoRepository.save(entity);
        logService.create(entity.getId(), "Criou o documento");

        if (entity.getStatus().equals(MemorandoStatus.PUBLISH)) {
            util.publishPipeline(entity);
            util.checkIfEveryoneHasSigned(entity);
            entity = memorandoRepository.save(entity);
        }

        return new MemorandoDto(entity);
    }

    @Transactional
    public MemorandoDto updateMemorando(Long id, MemorandoInsertDto dto) {
        Memorando entity = memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);

        if (!entity.getStatus().equals(MemorandoStatus.CREATED)) {
            throw new UnprocessableEntityException("Só é possível editar um Memorando com o status \"Salvo\"!");
        }

        User me = userService.authenticate();
        if (!me.getId().equals(entity.getCreatedBy().getId())) {
            throw new ForbiddenException("Você só pode editar um Memorando que criou!");
        }

        if (
            dto.getDepartments().size() == 1 &&
            dto.getDepartments().getFirst().equals(me.getPosition().getId())
        ) {
            throw new UnprocessableEntityException("É necessário ao menos 2 departamentos para continuar!");
        }

        if (entity.getNumber() != null && entity.getPublishedSnapshotJson() == null) util.rememberPublishedVersion(entity);

        util.dtoToEntity(dto, entity);
        util.addMyDepartment(entity);
        util.checkIfAllDepartmentsAreActive(entity);

        if (entity.getStatus().equals(MemorandoStatus.PUBLISH)) {
            util.addAllSignatures(entity);
            util.publishPipeline(entity);
            util.checkIfEveryoneHasSigned(entity);
        }

        entity = memorandoRepository.save(entity);
        return new MemorandoDto(entity);
    }

    @Transactional
    public MemorandoDto signMemorando(Long id) {
        Memorando entity = memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);

        if (!entity.getStatus().equals(MemorandoStatus.PUBLISH)) {
            throw new UnprocessableEntityException("Só é possível assinar um Memorando publicado!");
        }

        User me = userService.authenticate();

        util.signAll(entity);
        util.removeUserNotification(entity.getId(), me.getId());

        util.checkIfEveryoneHasSigned(entity);
        entity = memorandoRepository.save(entity);
        return new MemorandoDto(entity);
    }

    @CacheEvict(value = "homeInfo", allEntries = true)
    @Transactional
    public MemorandoDto cancelMemorando(Long id) {
        Memorando entity =  memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);

        if (entity.getStatus().equals(MemorandoStatus.CREATED)) {
            throw new UnprocessableEntityException("Não é possível cancelar um Memorando com status \"Salvo\"!");
        }

        User me = userService.authenticate();
        if (me.getAuthorities().stream().noneMatch(role ->
                    role.getAuthority().equals("ROLE_ADMIN"))) {
            throw new ForbiddenException("Apenas administradores podem cancelar um Memorando!");
        }

        entity.setStatus(MemorandoStatus.CANCELED);
        memorandoRepository.save(entity);
        util.removeNotifications(entity);

        logService.create(entity.getId(), "Cancelou o documento nº %d/%d".formatted(entity.getNumber(),
                entity.getCreateAt().atZone(ZoneId.systemDefault()).getYear()));

        return new MemorandoDto(entity);
    }

    @CacheEvict(value = "homeInfo", allEntries = true)
    @Transactional
    public MemorandoDto returnMemorandoToDraft(Long id) {
        Memorando entity = memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);

        if (
            !entity.getStatus().equals(MemorandoStatus.PUBLISH)
            && !entity.getStatus().equals(MemorandoStatus.APPROVED)
        ) {
            throw new UnprocessableEntityException("Somente registros com status publicado ou aprovado podem ser editados!");
        }

        User me = userService.authenticate();

        if (me.getAuthorities().stream().noneMatch(x -> x.getAuthority().equals("ROLE_ADMIN"))) {
            throw new UnprocessableEntityException("Somente administradores podem usar a opção rollback");
        }

        util.rememberPublishedVersion(entity);
        entity.setStatus(MemorandoStatus.CREATED);
        logService.create(entity.getId(), "Voltou o documento para status inicial");
        util.removeNotifications(entity);
        util.addAllSignatures(entity);

        entity = memorandoRepository.save(entity);
        return new MemorandoDto(entity);
    }

    @Transactional
    public MemorandoDto refreshSignatures(Long id, MemorandoIgnoreDto dto) {
        Memorando entity = memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);

        if (!entity.getStatus().equals(MemorandoStatus.PUBLISH)) {
            throw new UnprocessableEntityException("Somente registros com status publicado podem ser atualizados!");
        }

        User me = userService.authenticate();
        if (me.getAuthorities().stream().noneMatch(x -> x.getAuthority().equals("ROLE_ADMIN"))) {
            throw new UnprocessableEntityException("Somente administradores podem atualizar documentos!");
        }

        util.removeUserNotification(entity.getId(), dto.getUserId());

        /// atualizar assinaturas e notificações
        Position department = positionRepository.findById(dto.getDepartmentId()).orElseThrow(ResourceNotFoundException::new);
        entity.getSignatures().removeIf(s -> s.getDepartmentSigned().getId().equals(department.getId()));
        memorandoRepository.flush();

        for (User mananger : department.getManangers()) {
            entity.getSignatures().addLast(new Signature(entity, false, mananger, department));

            notificationService.create("Memorando nº %d - %s".formatted(entity.getNumber(), entity.getTitle()),
                    "/general/memorando/%d".formatted(entity.getId()), false, NotificationType.MEMORANDO,
                    entity.getId(), entity.getCreatedBy(), mananger);
        }

        /// log de atualização
        logService.create(entity.getId(), "Removeu e atualizou as assinaturas de %s".formatted(department.getName()));

        util.checkIfEveryoneHasSigned(entity);
        entity = memorandoRepository.save(entity);
        return new MemorandoDto(entity);
    }

    @Transactional
    public void deleteMemorando(Long id) {
        Memorando entity = memorandoRepository.findById(id).orElseThrow(ResourceNotFoundException::new);

        if (!entity.getStatus().equals(MemorandoStatus.CREATED)) {
            throw new UnprocessableEntityException("Apenas registros com o status CREATED podem ser deletados!");
        }

        if (entity.getNumber() != null) {
            throw new UnprocessableEntityException("Apenas documentos sem número registrado podem ser deletados!");
        }

        memorandoRepository.deleteById(id);
    }
}

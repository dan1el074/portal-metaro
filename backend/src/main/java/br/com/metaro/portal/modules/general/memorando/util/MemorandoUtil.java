package br.com.metaro.portal.modules.general.memorando.util;

import br.com.metaro.portal.core.dto.notification.NotificationDto;
import br.com.metaro.portal.core.entities.Notification;
import br.com.metaro.portal.core.entities.NotificationType;
import br.com.metaro.portal.core.entities.Position;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.PositionRepository;
import br.com.metaro.portal.core.services.NotificationService;
import br.com.metaro.portal.core.services.ParamService;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.memorando.dto.MemorandoInsertDto;
import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus;
import br.com.metaro.portal.modules.general.memorando.entity.Signature;
import br.com.metaro.portal.modules.general.memorando.repository.MemorandoRepository;
import br.com.metaro.portal.modules.general.memorando.service.MemorandoLogService;
import br.com.metaro.portal.modules.general.memorando.service.MemorandoPublicationHistoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class MemorandoUtil {
    @Autowired
    private UserService userService;
    @Autowired
    private NotificationService notificationService;
    @Autowired
    private MemorandoLogService logService;
    @Autowired
    private ParamService paramService;
    @Autowired
    private MemorandoRepository memorandoRepository;
    @Autowired
    private PositionRepository positionRepository;
    @Autowired
    private TaskScheduler taskScheduler;
    @Autowired
    private MemorandoScheduler memorandoScheduler;
    @Autowired
    private MemorandoPublicationHistoryService publicationHistory;

    public void rememberPublishedVersion(Memorando entity) {
        publicationHistory.capture(entity);
    }

    public void dtoToEntity(MemorandoInsertDto dto, Memorando entity) {
        entity.setRequest(dto.getRequest());
        entity.setClient(dto.getClient());
        entity.setErpSource(dto.getErpSource());
        entity.setItems(new ArrayList<>(dto.getItems()));
        entity.setTitle(dto.getTitle());
        entity.setDescription(dto.getDescription());
        entity.setReason(dto.getReason());
        entity.setStatus(dto.getStatus());

        List<Position> positions = positionRepository.findAllById(dto.getDepartments());
        if (positions.size() != dto.getDepartments().size()) {
            throw new UnprocessableEntityException("Um ou mais departamentos não foram encontrados!");
        }

        entity.setFromDepartments(new ArrayList<>(positions));
    }

//    public List<Memorando> filterByAccess(List<Memorando> entities) {
//        User me = userService.authenticate();
//        if (me.getRoles().stream().anyMatch(role -> role.getAuthority().equals("ROLE_ADMIN"))) {
//            return entities;
//        }
//
//        entities = entities.stream().filter(entity ->
//                (!entity.getStatus().equals(MemorandoStatus.CREATED)
//                        && !entity.getStatus().equals(MemorandoStatus.CANCELED))
//                        || entity.getCreatedBy().getId().equals(me.getId())
//        ).toList();
//
//        return entities;
//    }

    public void addAllSignatures(Memorando entity) {
        entity.getSignatures().clear();
        memorandoRepository.flush();

        for (Position department : entity.getFromDepartments()) {
            for (User mananger : department.getManangers()) {
                entity.getSignatures().addLast(new Signature(entity, false, mananger, department));
            }
        }
    }

    @CacheEvict(value = "homeInfo", allEntries = true)
    public void publishPipeline(Memorando entity) {
        if (entity.getSignatures().isEmpty()) {
            throw new UnprocessableEntityException("Não foram encontradas assinaturas pendentes!");
        }

        boolean republishing = entity.getNumber() != null;
        addNumberAndCreatedAt(entity);
        logService.create(entity.getId(), publicationHistory.publicationMessage(entity, republishing));
        publicationHistory.capture(entity);

        signAll(entity);
        notifyAllManangers(entity);
    }

    public void signAll(Memorando entity) {
        User me = userService.authenticate();

        for (Signature signature : entity.getSignatures()) {
            if (!signature.getUser().equals(me)) continue;
            if (signature.getIsSign()) continue;

            if (signature.getDepartmentSigned().getManangers().stream().noneMatch(u -> u.equals(me))) {
                throw new UnprocessableEntityException("Somente gestores podem assinar um Memorando!");
            }

            signature.setIsSign(true);
            signature.setSignedAt(Instant.now());
            logService.create(entity.getId(), "Assinou o documento (%s)"
                    .formatted(signature.getDepartmentSigned().getName()));
        }
    }

    public void notifyAllManangers(Memorando entity) {
        User me = userService.authenticate();
        Set<Long> notifiedUsers = new HashSet<>();

        for (Signature signature : entity.getSignatures()) {
            if (signature.getUser().equals(me)) continue;
            if (notifiedUsers.contains(signature.getUser().getId())) continue;

            notificationService.create("Memorando nº %d - %s".formatted(entity.getNumber(), entity.getTitle()),
                    "/general/memorando/%d".formatted(entity.getId()), false, NotificationType.MEMORANDO,
                    entity.getId(), me, signature.getUser());

            notifiedUsers.add(signature.getUser().getId());
        }
    }

    public void checkIfEveryoneHasSigned(Memorando entity) {
        if (entity.getSignatures().stream().noneMatch(s -> s.getIsSign().equals(false))) {
            entity.setStatus(MemorandoStatus.APPROVED);

            logService.system(entity.getId(), "Documento nº %d/%d aprovado por todas as áreas\n"
                    .formatted(entity.getNumber(), entity.getCreateAt().atZone(ZoneId.systemDefault()).getYear()));

            Long memorandoId = entity.getId();
            Long myId = userService.authenticate().getId();
            taskScheduler.schedule(
                () -> memorandoScheduler.executeSchedule(memorandoId, myId),
                Instant.now().plusSeconds(1)
            );
        }
    }

    public void addMyDepartment(Memorando entity) {
        User me = userService.authenticate();

        if (entity.getFromDepartments().stream().noneMatch(x -> x.getId().equals(me.getPosition().getId()))) {
            entity.getFromDepartments().addFirst(me.getPosition());
        }
    }

    public void checkIfAllDepartmentsAreActive(Memorando entity) {
        int count = 0;
        String departments = "";

        for (Position position : entity.getFromDepartments()) {
            if (position.getActivated().equals(false)) {
                count++;

                if (count == 1) {
                    departments = position.getName();
                    continue;
                }

                departments = departments.concat(", %s".formatted(position.getName()));
            }
        }

        if (count == 1) {
            throw new UnprocessableEntityException("O departamento %s está desativado!".formatted(departments));
        }
        if (count > 1) {
            throw new UnprocessableEntityException("Os seguintes departamentos estão desativados: %s".formatted(departments));
        }
    }

    public void addNumberAndCreatedAt(Memorando entity) {
        if (entity.getCreateAt() == null) entity.setCreateAt(Instant.now());
        if (entity.getNumber() == null) entity.setNumber(paramService.newMemorando());
    }

    public void removeNotifications(Memorando entity) {
        List<Notification> notifications = notificationService.findByReferenceIdAndType(entity.getId(), NotificationType.MEMORANDO);
        for (Notification notification : notifications) {
            notificationService.delete(notification.getId(), notification.getUser().getId());
        }
    }

    public void removeUserNotification(Long memorandoId, Long userId) {
        // TODO: N + 1

        for (NotificationDto notification : notificationService.listByUser(userId)) {
            if (
                notification.getType().equals(NotificationType.MEMORANDO.name())
                && notification.getReferenceId().equals(memorandoId)
            ) {
                notificationService.delete(notification.getId(), userId);
            }
        }
    }

    public void checkChanges(MemorandoInsertDto dto, Memorando entity) {
        if (!dto.getTitle().equals(entity.getTitle())) {
            logService.create(entity.getId(), "Alterou o título de \"%s\" para \"%s\""
                    .formatted(entity.getTitle(), dto.getTitle()));
        }
        if (!dto.getDescription().equals(entity.getDescription())) {
            logService.create(entity.getId(), "Alterou a descrição de \"%s\" para \"%s\""
                    .formatted(entity.getDescription().replace("<br>", " "),
                            dto.getDescription().replace("<br>", " ")));
        }
        if (!dto.getReason().equals(entity.getReason())) {
            logService.create(entity.getId(), "Alterou o motivo de \"%s\" para \"%s\""
                    .formatted(entity.getReason(), dto.getReason()));
        }

        diffPositions(dto, entity);
        diffItems(dto, entity);
    }

    private void diffPositions(MemorandoInsertDto dto, Memorando entity) {
        List<Position> positions = positionRepository.findAllById(dto.getDepartments());

        if (positions.size() != dto.getDepartments().size()) {
            throw new ResourceNotFoundException();
        }

        List<Position> addPositions = positions.stream().filter(currentPosition ->
                !entity.getFromDepartments().contains(currentPosition)).toList();

        List<Position> leftPositions = entity.getFromDepartments().stream().filter(currentPosition ->
                !positions.contains(currentPosition)).toList();

        if (!leftPositions.isEmpty()) {
            String nameOfDepartments = "";

            for (int i=0; i<leftPositions.size(); i++) {
                if (i > 0) nameOfDepartments = nameOfDepartments.concat(", ");
                if (leftPositions.get(i).getId().equals(entity.getCreatedBy().getPosition().getId())) continue;
                nameOfDepartments = nameOfDepartments.concat(leftPositions.get(i).getName());
            }

            logService.create(entity.getId(), "Removeu o(s) departamento(s) \"%s\"".formatted(nameOfDepartments));
        }

        if (!addPositions.isEmpty()) {
            String nameOfDepartments = "";

            for (int i=0; i<addPositions.size(); i++) {
                if (i > 0) nameOfDepartments = nameOfDepartments.concat(", ");
                nameOfDepartments = nameOfDepartments.concat(addPositions.get(i).getName());
            }

            logService.create(entity.getId(), "Adicionou o(s) departamento(s) \"%s\"".formatted(nameOfDepartments));
        }
    }

    private void diffItems(MemorandoInsertDto dto, Memorando entity) {
        List<String> addItems = dto.getItems().stream().filter(currentItem ->
                !entity.getItems().contains(currentItem)).toList();

        List<String> leftItems = entity.getItems().stream().filter(currentItem ->
                !dto.getItems().contains(currentItem)).toList();

        if (!addItems.isEmpty()) {
            String itemsChanged = "";

            for (int i=0; i<addItems.size(); i++) {
                if (i > 0) itemsChanged = itemsChanged.concat(", ");
                itemsChanged = itemsChanged.concat(addItems.get(i));
            }

            logService.create(entity.getId(), "Adicionou o(s) item(s) \"%s\"".formatted(itemsChanged));
        }

        if (!leftItems.isEmpty()) {
            String itemsChanged = "";

            for (int i=0; i<leftItems.size(); i++) {
                if (i > 0) itemsChanged = itemsChanged.concat(", ");
                itemsChanged = itemsChanged.concat(leftItems.get(i));
            }

            logService.create(entity.getId(), "Removeu o(s) item(s) \"%s\"".formatted(itemsChanged));
        }
    }
}

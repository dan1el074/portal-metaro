package br.com.metaro.portal.modules.pcp.serialplates.service;

import br.com.metaro.portal.core.entities.Param;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.repositories.ParamRepository;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.pcp.serialplates.dto.*;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistSerialPlateService;
import br.com.metaro.portal.modules.pcp.serialplates.entity.*;
import br.com.metaro.portal.modules.pcp.serialplates.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.BeanWrapper;
import org.springframework.beans.BeanWrapperImpl;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SerialPlateService {
    private static final List<String> STATUSES = List.of("Criado", "Programado", "Recebido", "Devolvido", "Finalizado");
    private static final Map<String, String> LABELS = labels();
    private static final Set<String> SORTS = Set.of("serial", "of", "order", "client", "description", "provider", "status", "updated");
    private final SerialPlateRepository repository;
    private final SerialPlateLogRepository logs;
    private final ParamRepository params;
    private final UserService users;
    private final SerialPlateErpService erp;
    private final ObjectMapper mapper;
    private final EntityManager entityManager;
    private final ChecklistSerialPlateService checklistSerialPlateService;

    @Transactional(readOnly = true)
    public List<SerialPlateRelocationDto> previewRelocation(SerialPlateMutationDto request) {
        if (!request.getFields().contains("order") && !request.getFields().contains("readyStock")) return List.of();
        List<SerialPlateRelocationDto> impacts = new ArrayList<>();
        for (Long serial : serials(request.getVersions().keySet())) {
            SerialPlate plate = repository.findById(serial).orElseThrow(ResourceNotFoundException::new);
            String order = request.getFields().contains("order") ? text(request.getPatch().getOrder()) : plate.getOrder();
            boolean readyStock = request.getFields().contains("readyStock")
                    ? Boolean.TRUE.equals(request.getPatch().getReadyStock()) : plate.getReadyStock();
            if (readyStock) order = "";
            checklistSerialPlateService.relocationImpact(serial, order).ifPresent(impacts::add);
        }
        return impacts;
    }


    @Transactional(readOnly = true)
    public Page<SerialPlateDto> listPlates(Pageable requested, String search, String status) {
        return repository.findAll(filter(search, status), pageable(requested)).map(this::dto);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getSummary() {
        Map<String, Long> result = new LinkedHashMap<>();
        STATUSES.forEach(status -> result.put(status, 0L));
        repository.countByStatus().forEach(row -> result.put((String) row[0], ((Number) row[1]).longValue()));
        result.put("total", result.values().stream().mapToLong(Long::longValue).sum());
        return result;
    }

    @Transactional(readOnly = true)
    public SerialPlateDto getPlate(Long serial) {
        return dto(repository.findById(serial).orElseThrow(ResourceNotFoundException::new));
    }

    @Transactional(readOnly = true)
    public List<SerialPlateHistoryDto> getHistory(Long serial) {
        if (!repository.existsById(serial)) throw new ResourceNotFoundException();

        List<SerialPlateLog> events = new ArrayList<>(logs.findBySerialOrderByAtDescIdDesc(serial));
        Collections.reverse(events);
        List<SerialPlateHistoryDto> history = new ArrayList<>();
        Map<String, String> state = new HashMap<>();

        for (SerialPlateLog event : events) {
            List<SerialPlateChangeDto> changes = readChanges(event);
            String beforeModel = state.getOrDefault(LABELS.get("description"), "");
            String afterModel = changes.stream().filter(change -> change.getField().equals(LABELS.get("description")))
                    .map(SerialPlateChangeDto::getAfter).findFirst().orElse(beforeModel);
            List<SerialPlateChangeDto> displayed = new ArrayList<>();

            for (SerialPlateChangeDto change : changes) {
                if (change.getField().equals(LABELS.get("orderItem"))) {
                    displayed.add(new SerialPlateChangeDto(change.getField(),
                            itemHistoryLabel(change.getBefore(), change.getBeforeLabel(), beforeModel),
                            itemHistoryLabel(change.getAfter(), change.getAfterLabel(), afterModel)));
                } else {
                    displayed.add(new SerialPlateChangeDto(change.getField(), change.getBefore(), change.getAfter()));
                }
                state.put(change.getField(), change.getAfter());
            }
            history.add(new SerialPlateHistoryDto(event.getAt(), event.getAuthor(), displayed));
        }
        Collections.reverse(history);
        return history;
    }

    private List<SerialPlateChangeDto> readChanges(SerialPlateLog event) {
        try {
            return mapper.readValue(
                event.getChangesJson(),
                mapper.getTypeFactory().constructCollectionType(List.class, SerialPlateChangeDto.class));
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Histórico de plaquetas inválido.", exception);
        }
    }

    private String itemHistoryLabel(String reference, String label, String model) {
        if (text(reference).isEmpty()) return "";
        if (!text(label).isEmpty()) return label;
        return text(model).isEmpty() ? "Item não identificado" : model;
    }

    @Transactional
    public List<SerialPlateDto> createPlates(SerialPlateCreateDto request) {
        int quantity = request.getQuantity().intValueExact();

        // Resolve upstream data before taking the global sequence lock.
        SerialPlateOrderDto order = text(request.getOrder()).isEmpty() ? null : erp.findOrder(request.getOrder());
        SerialPlateOrderItemDto item = order == null ? null : orderItem(order, request.getOrderItem());
        Param sequence = params.findLockedByName("serialPlatesCount").orElseThrow(ResourceNotFoundException::new);
        long last;

        try {
            last = Long.parseLong(sequence.getContent());
            if (last < 0 || last > Long.MAX_VALUE - quantity) throw new NumberFormatException();
        } catch (NumberFormatException exception) {
            throw invalid("O parâmetro serialPlatesCount deve conter o último número de série emitido válido.");
        }

        Long maximum = repository.findMaximumSerial();
        if (maximum != null && last < maximum) throw invalid("A sequência está abaixo do maior número de série existente. Corrija serialPlatesCount.");
        User user = users.authenticate();
        List<SerialPlate> created = new ArrayList<>();

        for (int index = 0; index < quantity; index++) {
            SerialPlate plate = new SerialPlate();
            plate.setSerial(++last);
            plate.setOf(text(request.getOf()));
            plate.setManufactured(YearMonth.now(ZoneId.of("America/Sao_Paulo")).toString());
            if (order != null) applyOrder(plate, request.getOrder(), order, item);
            validate(plate, null);
            plate.setUpdated(Instant.now());
            repository.save(plate);
            audit(plate.getSerial(), user, plate.getUpdated(), List.of(new SerialPlateChangeDto("Registro", "", "Registro criado")), snapshot(plate), Map.of(), item == null ? null : item.getLabel());
            created.add(plate);
        }

        sequence.setContent(Long.toString(last));
        repository.flush();

        return created.stream().map(this::dto).toList();
    }

    @Transactional
    public List<SerialPlateDto> updatePlates(SerialPlateMutationDto request) {
        if (!LABELS.keySet().containsAll(request.getFields())) throw invalid("Campo de atualização inválido.");
        if (request.getFields().contains("orderItem") && !request.getFields().contains("order")) throw invalid("Informe o pedido ao alterar seu item.");

        SerialPlatePatchDto patch = request.getPatch();
        boolean importing = request.getFields().contains("order") && !text(patch.getOrder()).isEmpty() && !(request.getFields().contains("readyStock") && Boolean.TRUE.equals(patch.getReadyStock()));

        if (importing && text(patch.getOrderItem()).isEmpty()) throw invalid("Selecione um item do pedido.");

        List<Long> requestedSerials = serials(request.getVersions().keySet());
        boolean changedReference = importing && repository.findAllById(requestedSerials).stream().anyMatch(plate ->
                !text(patch.getOrder()).equals(plate.getOrder()) || !Objects.equals(patch.getOrderItem(), plate.getOrderItem()));

        SerialPlateOrderDto order = changedReference ? erp.findOrder(patch.getOrder()) : null;
        SerialPlateOrderItemDto item = order == null ? null : orderItem(order, patch.getOrderItem());
        User user = users.authenticate();
        List<SerialPlate> updated = new ArrayList<>();

        for (Long serial : requestedSerials) {
            SerialPlate plate = repository.findLockedBySerial(serial).orElseThrow(ResourceNotFoundException::new);

            if (!Objects.equals(plate.getVersion(), request.getVersions().get(serial.toString()))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "O registro #" + serial + " foi alterado por outro usuário. Reabra o registro.");
            }

            Map<String, String> before = snapshot(plate);
            boolean changedOrder = order != null && (!text(patch.getOrder()).equals(plate.getOrder()) || !Objects.equals(patch.getOrderItem(), plate.getOrderItem()));

            if (changedOrder) applyOrder(plate, patch.getOrder(), order, item);

            BeanWrapper source = new BeanWrapperImpl(patch);
            BeanWrapper target = new BeanWrapperImpl(plate);

            for (String field : request.getFields()) {
                Object value = source.getPropertyValue(field);
                if (value == null && !Set.of("capacity", "weight").contains(field)) throw invalid("Valor inválido para " + LABELS.get(field) + ".");
                target.setPropertyValue(field, value);
            }

            if (Boolean.TRUE.equals(patch.getReadyStock()) && request.getFields().contains("readyStock")) {
                plate.setOrder("");
            } else if (request.getFields().contains("order") && !text(patch.getOrder()).isEmpty()) {
                plate.setReadyStock(false);
            }

            if (plate.getReadyStock()) {
                plate.setOrder(""); plate.setOrderItem(""); plate.setClient("");
            } else if (text(plate.getOrder()).isEmpty()) plate.setOrderItem("");

            if (!text(plate.getProvider()).isEmpty() && before.get(LABELS.get("provider")).isEmpty() && plate.getStatus().equals("Criado")) plate.setStatus("Programado");
            validate(plate, before.get(LABELS.get("status")));
            Map<String, String> after = snapshot(plate);

            if (!before.equals(after)) {
                plate.setUpdated(Instant.now());
                checklistSerialPlateService.synchronizePlate(plate, changedOrder ? item.getLabel() : null, user, request.isConfirmRelocation());
                audit(serial, user, plate.getUpdated(), List.of(), after, before, changedOrder ? item.getLabel() : null);
            }
            updated.add(plate);
        }

        repository.flush();
        return updated.stream().map(this::dto).toList();
    }

    @Transactional(readOnly = true)
    public List<SerialPlateDto> getSelection(Collection<String> selection) {
        List<Long> ids = serials(selection);
        List<SerialPlate> found = repository.findAllById(ids);

        if (found.size() != ids.size()) throw invalid("Um ou mais números de série não foram encontrados.");

        Map<Long, SerialPlate> byId = new HashMap<>();
        found.forEach(plate -> byId.put(plate.getSerial(), plate));

        return ids.stream().map(id -> dto(byId.get(id))).toList();
    }

    @Transactional(readOnly = true)
    public List<SerialPlateDto> getRange(String anchor, String target, Pageable requested, String search, String status) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();
        CriteriaQuery<Long> query = cb.createQuery(Long.class);
        Root<SerialPlate> root = query.from(SerialPlate.class);
        query.select(root.get("serial")).where(filter(search, status).toPredicate(root, query, cb));
        query.orderBy(pageable(requested).getSort().stream().map(sort -> sort.isAscending() ? cb.asc(root.get(sort.getProperty())) : cb.desc(root.get(sort.getProperty()))).toList());
        List<Long> ids = entityManager.createQuery(query).getResultList();
        int start = ids.indexOf(parseSerial(anchor));
        int end = ids.indexOf(parseSerial(target));

        if (start < 0 || end < 0) return getSelection(List.of(target));
        if (Math.abs(end - start) >= 10000) throw invalid("Selecione no máximo 10000 registros por operação.");

        return getSelection(ids.subList(Math.min(start, end), Math.max(start, end) + 1).stream().map(Object::toString).toList());
    }

    @Transactional(readOnly = true)
    public SerialPlateSettingsDto getSettings() {
        SerialPlateSettingsDto dto = new SerialPlateSettingsDto();
        dto.setCrea(param("serialPlates.crea"));
        dto.setInstructions(param("serialPlates.instructions"));
        dto.setProviders(param("serialPlates.providers"));

        return dto;
    }

    @Transactional
    public SerialPlateSettingsDto updateSettings(SerialPlateSettingsDto dto) {
        List.of("serialPlates.crea", "serialPlates.instructions", "serialPlates.providers").forEach(key -> params.findLockedByName(key).orElseThrow(ResourceNotFoundException::new));
        User user = users.authenticate();
        Map<String, String> changes = Map.of("CREA", dto.getCrea().trim(), "Orientações", dto.getInstructions().trim(), "Prestadores", dto.getProviders().trim());
        SerialPlateSettingsDto before = getSettings();
        audit(null, user, Instant.now(), List.of(), changes, Map.of("CREA", before.getCrea(), "Orientações", before.getInstructions(), "Prestadores", before.getProviders()), null);
        saveParam("serialPlates.crea", dto.getCrea().trim());
        saveParam("serialPlates.instructions", dto.getInstructions().trim());
        saveParam("serialPlates.providers", dto.getProviders().trim());

        return getSettings();
    }

    @Transactional(readOnly = true)
    public SerialPlateReportDto prepareReport(SerialPlateSelectionDto selection) {
        SerialPlateSettingsDto settings = getSettings();
        if (settings.getCrea().isBlank()) throw invalid("Informe o CREA nas configurações.");
        List<SerialPlateDto> records = getSelection(selection.getSerials());

        for (SerialPlateDto row : records) {
            if (row.getDescription().isBlank()
                    || row.getVoltage().isBlank()
                    || row.getWeight() == null) throw invalid("Complete modelo, tensão e peso do registro #" + row.getSerial() + ".");
        }

        return new SerialPlateReportDto(records, settings);
    }

    private Specification<SerialPlate> filter(String search, String status) {
        if (status != null && !status.isBlank() && !STATUSES.contains(status)) throw invalid("Status inválido.");

        return (root, query, cb) -> {
            List<Predicate> conditions = new ArrayList<>();

            if (status != null && !status.isBlank()) conditions.add(cb.equal(root.get("status"), status));

            if (search != null && !search.isBlank()) {
                String term = search.trim().toLowerCase(Locale.ROOT);
                String pattern = "%" + term.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
                List<Predicate> matches = new ArrayList<>();
                for (String field : LABELS.keySet()) {
                    if (!field.equals("readyStock")) matches.add(cb.like(cb.lower(root.get(field).as(String.class)), pattern, '!'));
                }
                matches.add(cb.like(root.get("serial").as(String.class), pattern, '!'));
                if ("pe pronta entrega".contains(term)) matches.add(cb.isTrue(root.get("readyStock")));
                conditions.add(cb.or(matches.toArray(Predicate[]::new)));
            }

            return cb.and(conditions.toArray(Predicate[]::new));
        };
    }

    private Pageable pageable(Pageable requested) {
        List<Sort.Order> orders = new ArrayList<>(requested.getSort().stream().filter(order -> SORTS.contains(order.getProperty())).toList());
        if (orders.isEmpty()) orders.add(Sort.Order.desc("serial"));
        if (orders.stream().noneMatch(order -> order.getProperty().equals("serial"))) orders.add(Sort.Order.desc("serial"));
        return PageRequest.of(Math.max(0, requested.getPageNumber()), Math.max(1, Math.min(200, requested.getPageSize())), Sort.by(orders));
    }

    private SerialPlateOrderItemDto orderItem(SerialPlateOrderDto order, String id) {
        if (id == null || id.isBlank()) return order.getItems().getFirst();
        return order.getItems().stream().filter(item -> item.getId().equals(id)).findFirst().orElseThrow(() -> invalid("O item do pedido foi alterado. Consulte o ERP novamente."));
    }

    private void applyOrder(SerialPlate plate, String number, SerialPlateOrderDto order, SerialPlateOrderItemDto item) {
        plate.setOrder(number.trim()); plate.setOrderItem(item.getId()); plate.setReadyStock(false);
        plate.setClient(order.getClient()); plate.setDescription(item.getDescription()); plate.setVoltage(item.getVoltage());
        plate.setCapacity(item.getCapacity()); plate.setWeight(item.getWeight());
    }

    private void validate(SerialPlate plate, String previousStatus) {
        plate.setOf(text(plate.getOf()));
        if (plate.getOf().isBlank() || plate.getOf().length() > 80) throw invalid("Informe a ordem de fabricação (até 80 caracteres).");
        if (!plate.getOrder().matches("[0-9]{0,15}")) throw invalid("Número do pedido inválido.");
        if (!plate.getManufactured().matches("[1-9][0-9]{3}-(0[1-9]|1[0-2])")) throw invalid("Informe mês e ano de fabricação válidos.");
        // Retired status may be preserved on existing records, but never assigned again.
        boolean preservingLegacyStatus = "Terceiro".equals(previousStatus) && "Terceiro".equals(plate.getStatus());
        if (!STATUSES.contains(plate.getStatus()) && !preservingLegacyStatus) throw invalid("Status inválido.");
        if (!plate.getStatus().equals("Criado") && text(plate.getProvider()).isEmpty()) throw invalid("Informe o prestador de serviço para esse status.");

        for (BigDecimal value : Arrays.asList(plate.getCapacity(), plate.getWeight())) {
            if (value != null && (value.signum() <= 0 || value.scale() > 6 || value.precision() - value.scale() > 12)) throw invalid("Capacidade e peso devem ser positivos, com até seis casas decimais.");
        }

        if (plate.getOrderItem().length() > 64 || plate.getClient().length() > 500 || plate.getDescription().length() > 1000 || plate.getVoltage().length() > 120 || plate.getProvider().length() > 255 || plate.getNotes().length() > 10000) throw invalid("Um dos campos ultrapassa o tamanho permitido.");
    }

    private SerialPlateDto dto(SerialPlate entity) {
        SerialPlateDto dto = new SerialPlateDto();
        BeanUtils.copyProperties(entity, dto, "serial");
        dto.setSerial(entity.getSerial().toString());
        return dto;
    }

    private String display(Object value) {
        return value instanceof BigDecimal decimal ? decimal.stripTrailingZeros().toPlainString() : Objects.toString(value, "");
    }

    private Map<String, String> snapshot(SerialPlate plate) {
        BeanWrapper bean = new BeanWrapperImpl(plate);
        Map<String, String> values = new LinkedHashMap<>();
        LABELS.forEach((field, label) -> values.put(label, display(bean.getPropertyValue(field))));
        return values;
    }

    private void audit(Long serial, User user, Instant at, List<SerialPlateChangeDto> initial, Map<String, String> after, Map<String, String> before, String itemLabel) {
        List<SerialPlateChangeDto> changes = new ArrayList<>(initial);
        after.forEach((field, value) -> {
            if (!value.equals(before.getOrDefault(field, ""))) changes.add(new SerialPlateChangeDto(field, before.getOrDefault(field, ""), value));
        });

        if (changes.isEmpty()) return;

        for (SerialPlateChangeDto change : changes) {
            if (!change.getField().equals(LABELS.get("orderItem"))) continue;
            String previousLabel = previousItemLabel(serial, change.getBefore(), before.getOrDefault(LABELS.get("description"), ""));
            change.setBeforeLabel(previousLabel);
            change.setAfterLabel(itemHistoryLabel(change.getAfter(), itemLabel, after.getOrDefault(LABELS.get("description"), "")));
        }

        SerialPlateLog log = new SerialPlateLog();
        log.setSerial(serial); log.setUserId(user.getId()); log.setAuthor(user.getName()); log.setAt(at);

        try {
            log.setChangesJson(mapper.writeValueAsString(changes));
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException(exception);
        }

        logs.save(log);
    }

    private String previousItemLabel(Long serial, String reference, String model) {
        if (text(reference).isEmpty()) return "";

        for (SerialPlateLog event : logs.findBySerialOrderByAtDescIdDesc(serial)) {
            for (SerialPlateChangeDto change : readChanges(event)) {
                if (change.getField().equals(LABELS.get("orderItem")) && reference.equals(change.getAfter()) && !text(change.getAfterLabel()).isEmpty()) {
                    return change.getAfterLabel();
                }
            }
        }

        return itemHistoryLabel(reference, null, model);
    }

    private List<Long> serials(Collection<String> values) {
        if (values == null || values.isEmpty() || values.size() > 10000) throw invalid("Seleção inválida.");
        return values.stream().map(this::parseSerial).distinct().sorted().toList();
    }

    private Long parseSerial(String value) {
        try {
            if (value == null || !value.matches("[1-9][0-9]{0,18}")) throw new NumberFormatException();
            return Long.valueOf(value);
        } catch (NumberFormatException exception) { throw invalid("Número de série inválido."); }
    }

    private String param(String key) { return params.findByName(key).map(Param::getContent).orElse(""); }
    private void saveParam(String key, String value) {
        Param param = params.findLockedByName(key).orElseThrow(ResourceNotFoundException::new);
        param.setContent(value);
    }

    private String text(String value) { return value == null ? "" : value.trim(); }
    private UnprocessableEntityException invalid(String message) { return new UnprocessableEntityException(message); }
    private static Map<String, String> labels() {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put("of", "Ordem de fabricação"); labels.put("order", "Nº Pedido"); labels.put("orderItem", "Item do pedido");
        labels.put("readyStock", "Pronta Entrega"); labels.put("client", "Cliente"); labels.put("description", "Modelo");
        labels.put("capacity", "Capacidade"); labels.put("voltage", "Voltagem"); labels.put("weight", "Peso");
        labels.put("provider", "Prestador de serviço"); labels.put("status", "Status"); labels.put("notes", "Observações");
        labels.put("manufactured", "Data de fabricação");
        return Collections.unmodifiableMap(labels);
    }
}

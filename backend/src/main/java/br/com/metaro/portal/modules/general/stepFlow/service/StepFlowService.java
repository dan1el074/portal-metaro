package br.com.metaro.portal.modules.general.stepFlow.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ForbiddenException;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.stepFlow.dto.*;
import br.com.metaro.portal.modules.general.stepFlow.entities.*;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import br.com.metaro.portal.modules.general.stepFlow.repositories.projections.StatusCountsProjection;
import br.com.metaro.portal.modules.general.stepFlow.repositories.projections.StepCountProjection;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistStepFlowService;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistStepBindingDto;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import br.com.metaro.portal.util.erp.dto.ErpOrderItemDto;
import br.com.metaro.portal.util.others.StringUtils;
import br.com.metaro.portal.util.picture.PictureService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class StepFlowService {
    @Autowired
    private OrderRepository orderRepository;
    @Autowired
    private ObjectMapper objectMapper;
    @Autowired
    private UserService userService;
    @Autowired
    private PictureService pictureService;
    @Autowired
    private ChecklistStepFlowService checklistStepFlowService;

    @Transactional(readOnly = true)
    public OrderDto findById(Long id) {
        Order dto = orderRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        return new OrderDto(dto);
    }

    @Transactional(readOnly = true)
    public Page<OrderMinDto> listOrders(Pageable pageable, String search, String stepFilter) {
        pageable = withIdDescendingAsLastSort(pageable);
        String translated = search;
        String onlyStep = stepFilter;

        if (translated != null) {
            StepType step = StepType.fromDescription(search);
            if (step != null) translated = step.name();

            OrderStatus status = OrderStatus.fromDescription(search);
            if (status != null) translated = status.name();
        }

        if (onlyStep != null) {
            StepType step = StepType.fromDescription(stepFilter);
            if (step != null) onlyStep = step.name();
        }

        Page<Order> entities;
        Sort.Order statusSort = pageable.getSort().getOrderFor("status");

        if (statusSort != null) {
            Pageable remainingSortPageable = withoutStatusSort(pageable);
            int direction = statusSort.isAscending() ? 1 : -1;

            if (onlyStep != null) {
                entities = orderRepository.searchOnlyStepOrderByEffectiveStatus(
                        remainingSortPageable,
                        translated != null ? translated : "",
                        onlyStep,
                        OrderStatus.CANCELLED,
                        direction
                );
                return entities.map(OrderMinDto::new);
            }

            entities = orderRepository.searchOrderByEffectiveStatus(
                    remainingSortPageable,
                    translated != null ? translated : "",
                    direction
            );
            return entities.map(OrderMinDto::new);
        }

        if (onlyStep != null) {
            entities = orderRepository.searchOnlyStep(
                    pageable,
                    translated != null ? translated : "",
                    onlyStep,
                    OrderStatus.CANCELLED
            );
            return entities.map(OrderMinDto::new);
        }

        entities = orderRepository.search(pageable, translated != null ? translated : "");
        return entities.map(OrderMinDto::new);
    }

    private Pageable withoutStatusSort(Pageable pageable) {
        List<Sort.Order> remainingOrders = pageable.getSort().stream()
                .filter(order -> !order.getProperty().equals("status"))
                .toList();

        Sort remainingSort = remainingOrders.isEmpty()
                ? Sort.by(Sort.Direction.DESC, "id")
                : Sort.by(remainingOrders);

        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), remainingSort);
    }

    private Pageable withIdDescendingAsLastSort(Pageable pageable) {
        List<Sort.Order> orders = new ArrayList<>(pageable.getSort().stream()
                .filter(order -> !order.getProperty().equals("id"))
                .toList());
        orders.add(Sort.Order.desc("id"));

        return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(orders));
    }

    @Transactional(readOnly = true)
    public List<OrderMinDto> listOrdersByCurrentStep(Integer ordinal) {
        List<Order> entities = orderRepository.findByCurrentStep(StepType.values()[ordinal], StepStatus.ACTIVE, OrderStatus.CANCELLED);
        return entities.stream().map(OrderMinDto::new).toList();
    }

    @Transactional(readOnly = true)
    public StepFlowInfoDto generateDashboard() {
        StatusCountsProjection counts = orderRepository.findCountByStatus().orElseThrow(ResourceNotFoundException::new);
        Integer total = counts.getTotalCount() != null ? counts.getTotalCount().intValue() : 0;
        Integer progress = counts.getProgressCount() != null ? counts.getProgressCount().intValue() : 0;
        Integer complete = counts.getCompleteCount() != null ? counts.getCompleteCount().intValue() : 0;
        Integer late = counts.getLateCount() != null ? counts.getLateCount().intValue() : 0;

        Map<StepType, Integer> stepMap = orderRepository.findCountByStep(OrderStatus.IN_PROGRESS).stream().collect(Collectors
                .toMap(StepCountProjection::getStep, row -> row.getCount().intValue()));

        List<Integer> stepsCount = Arrays.stream(StepType.values())
                .map(step -> stepMap.getOrDefault(step, 0))
                .toList();

        Map<StepType, Integer> lateStepMap = orderRepository.findLateCountByStep().stream().collect(Collectors
                .toMap(StepCountProjection::getStep, row -> row.getCount().intValue()));

        List<Integer> stepsLateCount = Arrays.stream(StepType.values())
                .map(step -> lateStepMap.getOrDefault(step, 0))
                .toList();

        return new StepFlowInfoDto(total, progress, complete, late, stepsCount, stepsLateCount);
    }

    @Transactional
    public void create(ErpOrderDto erpOrder) {
        create(erpOrder, false);
    }

    @Transactional
    public void create(ErpOrderDto erpOrder, boolean legacy) {
        if (legacy) {
            User user = userService.authenticate();
            if (!user.hasRole("ROLE_ADMIN")) {
                throw new ForbiddenException("Somente administradores podem criar um Fluxo de etapas na versão legado.");
            }
        }
        Order entity = new Order();
        entity.setChecklistIntegration(!legacy);
        snapshotErpInfo(entity, erpOrder);
        setOrderOccurrence(entity);
        addAllSteps(entity);

        entity.setCurrentStep(StepType.FINAL_ASSEMBLY);
        entity.setStatus(OrderStatus.IN_PROGRESS);
        entity.setShipment(0.0);
        entity.setVolumes(new ArrayList<>());

        this.orderRepository.save(entity);
        if (!legacy) {
            checklistStepFlowService.createBindings(entity, erpOrder.getChecklistFlowIds());
        }
    }

    private void setOrderOccurrence(Order order) {
        long registeredOrders = orderRepository.countByNumber(order.getNumber());
        order.setOccurrence(Math.toIntExact(registeredOrders + 1));
    }

    @Transactional
    public OrderDto update(Long id, OrderInputDto dto) throws IOException {
        if (dto.getChecklistFlowIds() != null) checklistStepFlowService.lockFlows(dto.getChecklistFlowIds());
        Order order = orderRepository.findLockedById(id).orElseThrow(ResourceNotFoundException::new);
        if (dto.getChecklistFlowIds() != null) checklistStepFlowService.assertBindingManagementAllowed(order);
        Integer newStepId = dto.getNewStepId();
        // Save production data and bindings while still at Final Assembly, then change stage.
        if (dto.getChecklistFlowIds() != null) dto.setNewStepId(null);
        try {
            rulesForUpdate(dto, order);
        } finally {
            dto.setNewStepId(newStepId);
        }
        if (dto.getChecklistFlowIds() != null) {
            ChecklistStepBindingDto bindings = new ChecklistStepBindingDto();
            bindings.setFlowIds(dto.getChecklistFlowIds());
            checklistStepFlowService.replaceBindings(id, bindings);
            if (newStepId != null) {
                OrderInputDto stageUpdate = new OrderInputDto();
                stageUpdate.setNewStepId(newStepId);
                rulesForUpdate(stageUpdate, order);
            }
        } else if (dto.getItems() != null && !dto.getItems().isEmpty()) {
            checklistStepFlowService.assertEquipmentCapacity(order);
        }
        return new OrderDto(order);
    }

    @Transactional
    public OrderDto reopen(Long id) {
        User me = userService.authenticate();
        if (me.getAuthorities().stream().noneMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"))) {
            throw new ForbiddenException("Apenas administradores podem reabrir fluxos de etapas!");
        }
        Order order = checklistStepFlowService.lockForReopening(id);
        if (order.getStatus() != OrderStatus.COMPLETED && order.getStatus() != OrderStatus.CANCELLED) {
            throw new UnprocessableEntityException("Somente fluxos finalizados ou cancelados podem ser reabertos!");
        }
        OrderStep current = order.getSteps().stream().filter(step -> step.getStep() == order.getCurrentStep())
                .findFirst().orElseThrow(ResourceNotFoundException::new);
        current.getMessages().add(new StepMessage("Fluxo de etapas reaberto pelo administrador. Status anterior: "
                + order.getStatus() + ".", current, me));
        current.setStatus(StepStatus.ACTIVE);
        current.setChecklistPending(false);
        current.setFinishedAt(null);
        current.setFinishedBy(null);
        order.setStatus(OrderStatus.IN_PROGRESS);
        return new OrderDto(orderRepository.save(order));
    }

    @Transactional
    public void goToNextStep(Long id) {
        Order order = this.orderRepository.findById(id).orElseThrow(ResourceNotFoundException::new);

        if (order.getStatus().equals(OrderStatus.CANCELLED)) {
            throw new UnprocessableEntityException("Não é possível editar um pedido cancelado!");
        }

        StepType type = order.getCurrentStep();
        OrderStep currentStep = order.getSteps().stream().filter(step -> step.getStep().equals(type))
                .findFirst().orElseThrow(ResourceNotFoundException::new);

        if (type.equals(StepType.FINAL_ASSEMBLY) || type.equals(StepType.SHIPPING)) {
            checkIfHavePictures(order);
        }

        if (order.isChecklistIntegration() && !checklistStepFlowService.isStepRequirementSatisfied(order.getId(), type)) {
            currentStep.setChecklistPending(true);
            orderRepository.save(order);
            return;
        }

        if (!order.isChecklistIntegration()) checklistStepFlowService.assertStepCanFinish(order.getId(), type);

        currentStep.setStatus(StepStatus.DONE);
        currentStep.setFinishedAt(Instant.now());
        currentStep.setFinishedBy(userService.authenticate());

        if (type.equals(StepType.FINAL_ASSEMBLY)) {
            checkVolumes(order);
        }

        if (type.equals(StepType.SHIPPING)) {
            order.setStatus(OrderStatus.COMPLETED);
        }

        if (!type.equals(StepType.SHIPPING)) {
            StepType nextType = StepType.values()[type.ordinal() + 1];
            OrderStep nextStep = order.getSteps().stream().filter(step -> step.getStep().equals(nextType))
                    .findFirst().orElseThrow(ResourceNotFoundException::new);

            order.setCurrentStep(nextType);
            nextStep.setStatus(StepStatus.ACTIVE);
            nextStep.setStartedAt(Instant.now());
        }

        orderRepository.save(order);
    }

    @Transactional
    public void deleteImageById(Long id) throws IOException {
        User me = userService.authenticate();

        if (
            !me.getPosition().getName().equals("Montagem Final")
            && !me.getPosition().getName().equals("Almoxarifado")
            && me.getAuthorities().stream().noneMatch(x ->
                    x.getAuthority().equals("ROLE_ADMIN"))
        ) {
            throw new ForbiddenException("Você não tem permissão para excluir essa imagem!");
        }

        pictureService.delete(id);
    }

    private void snapshotErpInfo(Order entity, ErpOrderDto order) {
        entity.setNumber(order.getNumber());
        entity.setClient(order.getClient());
        entity.setCnpj(order.getCnpj());
        entity.setSeller(order.getSalesperson());
        entity.setStartDate(order.getStartDate());
        entity.setDueDate(order.getDueDate());
        entity.setAddress(order.getAddress());
        entity.setSubtotal(order.getSubtotal());
        entity.setDiscount(order.getDiscount());
        entity.setTotal(order.getTotal());
        entity.setErpSource(order.getSource());
        entity.setItems(new ArrayList<>());

        if (order.getPhone() != null) entity.setPhone(order.getPhone());

        for (ErpOrderItemDto dto : order.getItems()) {
            OrderItem item = new OrderItem();

            item.setItemCode(dto.getCode());
            item.setDescription(dto.getDescription());
            item.setUnit(dto.getUnit());
            item.setQuantity(dto.getQuantity());
            item.setProducedQuantity(dto.getProducedQuantity());
            item.setUnitPrice(dto.getUnitValue());
            item.setTotal(dto.getUnitValue() * dto.getQuantity());

            entity.addItem(item);
        }
    }

    private void addAllSteps(Order entity) {
        entity.setSteps(new ArrayList<>());

        for (int i=0; i<5; i++) {
            OrderStep step = new OrderStep();

            step.setStep(StepType.values()[i]);
            step.setStatus(StepStatus.WAITING);
            step.setMessages(new ArrayList<>());
            step.setPictures(new ArrayList<>());
            step.setVideos(new ArrayList<>());

            entity.addStep(step);
        }

        entity.getSteps().getFirst().setStatus(StepStatus.ACTIVE);
        entity.getSteps().getFirst().setStartedAt(Instant.now());
    }

    private void rulesForUpdate(OrderInputDto dto, Order order) throws IOException {
        User me = userService.authenticate();

        if (!canInteract(order, me)) {
            throw new ForbiddenException("Usuário não corresponde ao setor competente!");
        }
        if (order.getStatus().equals(OrderStatus.CANCELLED)) {
            throw new UnprocessableEntityException("Não é possível editar um pedido cancelado!");
        }
        if (order.getStatus().equals(OrderStatus.COMPLETED)) {
            throw new UnprocessableEntityException("Não é possível editar um pedido concluído!");
        }

        OrderStep currentStep = order.getSteps()
                .stream()
                .filter(step -> step.getStep().equals(order.getCurrentStep()))
                .findFirst()
                .orElseThrow(ResourceNotFoundException::new);

        if (dto.getComment() != null && !dto.getComment().trim().isEmpty()) {
            currentStep.getMessages().add(new StepMessage(StringUtils.toMarkdown(dto.getComment()), currentStep, me));
        }

        if (dto.getNewStepId() != null) {
            if (dto.getNewStepId() < 0 || dto.getNewStepId() >= StepType.values().length) {
                throw new UnprocessableEntityException("Etapa inválida!");
            }

            StepType newStep = StepType.values()[dto.getNewStepId()];
            if (order.getCurrentStep() != newStep) {

                boolean isAdmin = me.getAuthorities().stream().anyMatch(a -> a
                        .getAuthority().equals("ROLE_ADMIN"));

                boolean isPcpReturn = order.getCurrentStep() == StepType.PCP && newStep == StepType.FINAL_ASSEMBLY;
                if (!isAdmin && !isPcpReturn) {
                    throw new ForbiddenException("Apenas administradores podem alterar etapas!");
                }

                currentStep.getMessages().add(new StepMessage("*Etapa alterada*: %s -> %s".formatted(order.getCurrentStep()
                        .getDescription(), newStep.getDescription()), currentStep, me));

                boolean movingForward = newStep.ordinal() > order.getCurrentStep().ordinal();
                Instant transitionAt = Instant.now();
                order.setCurrentStep(newStep);

                for (OrderStep step : order.getSteps()) {
                    if (step.getStep().ordinal() < dto.getNewStepId()) {
                        if (movingForward && step.getStatus() != StepStatus.DONE) {
                            if (step.getStartedAt() == null) {
                                step.setStartedAt(transitionAt);
                            }
                            step.setFinishedAt(transitionAt);
                            step.setFinishedBy(me);
                        }
                        step.setStatus(StepStatus.DONE);
                        continue;
                    }
                    if (step.getStep().ordinal() == dto.getNewStepId()) {
                        step.setStatus(StepStatus.ACTIVE);
                        if (movingForward || isPcpReturn) {
                            step.setStartedAt(transitionAt);
                            step.setFinishedAt(null);
                            step.setFinishedBy(null);
                        }
                        continue;
                    }

                    step.setStatus(StepStatus.WAITING);
                }
            }
        }

        switch (order.getCurrentStep()) {
            case FINAL_ASSEMBLY -> {
                proccessImage(dto, currentStep);
                checkQuantity(dto, order);
            }
            case PCP -> checkCancelled(dto, order);
            case FREIGHT -> {
                if (dto.getCarrier() != null) order.setCarrier(dto.getCarrier());
                if (dto.getShippment() != null) order.setShipment(Double.parseDouble(dto.getShippment()));
            }
            case SHIPPING -> proccessImage(dto, currentStep);
        }
    }

    private void checkQuantity(OrderInputDto dto, Order order) {
        if (dto.getItems() == null || dto.getItems().isEmpty()) return;

        // verifica se houve alteração
        boolean found = false;
        for (OrderItemInputDto input : dto.getItems()) {
            OrderItem item = order.getItems().stream().filter(currentItem -> currentItem.getId()
                    .equals(input.getId())).findFirst().orElseThrow(ResourceNotFoundException::new);

            if (input.getProducedQuantity() != null && !input.getProducedQuantity().equals(item.getProducedQuantity())) {
                found = true;
                break;
            }
        }
        if (!found) return;

        // traz todas as ordens desse mesmo código, exceto esse
        List<Order> orders = orderRepository.findByNumber(order.getNumber(), OrderStatus.CANCELLED);
        orders = orders.stream().filter(o -> !o.getId().equals(order.getId())).toList();

        List<OrderItem> items = order.getItems();

        for (OrderItem item : items) {
            Integer totalProduced = 0;

            for (Order currentOrder : orders) {
                for (OrderItem orderItem : currentOrder.getItems()) {
                    if (!orderItem.getItemCode().equals(item.getItemCode())) continue;
                    totalProduced += orderItem.getProducedQuantity();
                }
            }

            OrderItemInputDto inputDto = dto.getItems().stream()
                    .filter(oii -> oii.getId().equals(item.getId()))
                    .findFirst().orElseThrow(ResourceNotFoundException::new);

            if (inputDto.getProducedQuantity() <= (item.getQuantity() - totalProduced)) {
                item.setProducedQuantity(inputDto.getProducedQuantity());
                continue;
            }

            throw new UnprocessableEntityException("Essa quantidade de itens não pode ser utilizada!");
        }
    }

    private void checkCancelled(OrderInputDto dto, Order order) {
        if (dto.getCancelled() == null || !dto.getCancelled().equals("true")) return;

        order.setStatus(OrderStatus.CANCELLED);
    }

    private BigDecimal parseMeasurement(String value, String fieldName) {
        try {
            if (value == null || value.isBlank()) throw new NumberFormatException();
            BigDecimal measurement = new BigDecimal(value.replace(',', '.'));
            if (measurement.signum() < 0 || measurement.scale() > 2) throw new NumberFormatException();
            return measurement.setScale(2, RoundingMode.UNNECESSARY);
        } catch (NumberFormatException | ArithmeticException exception) {
            throw new UnprocessableEntityException(fieldName + " deve ser um número maior ou igual a zero, com até 2 casas decimais!");
        }
    }

    private void checkVolumes(Order order) {
        User me = userService.authenticate();
        boolean isAdmin = me.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));

        if (!isAdmin && order.getVolumes().isEmpty()) {
            throw new UnprocessableEntityException("Cadastre ao menos um volume antes de avançar!");
        }
    }

    private void proccessImage(OrderInputDto dto, OrderStep step) throws IOException {
        if (dto.getImages() == null || dto.getImages().length == 0) return;

        pictureService.saveStepFlowImages(Arrays.stream(dto.getImages()).toList(), step);
    }

    private boolean canInteract(Order order, User user) {
        if (user.getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"))) return true;

        return switch (order.getCurrentStep()) {
            case FINAL_ASSEMBLY -> user.getPosition().getName().equals("Montagem Final")
                                || user.getPosition().getName().equals("Almoxarifado");
            case PCP ->  user.getPosition().getName().equals("PCP");
            case FREIGHT -> user.getPosition().getName().equals("Comercial");
            case BILLING -> user.getPosition().getName().equals("Financeiro");
            case SHIPPING -> user.getPosition().getName().equals("Almoxarifado");
        };
    }

    public List<Long> parseChecklistFlowIds(String value) throws IOException {
        if (value == null) return null;
        List<Long> ids = objectMapper.readValue(value, new TypeReference<>() {});
        if (ids == null || ids.contains(null)) throw new UnprocessableEntityException("Informe uma lista válida de checklists.");
        return ids;
    }

    public List<OrderItemInputDto> parseItems(String itemsJson) throws IOException {
        if (itemsJson == null || itemsJson.isBlank()) return List.of();
        return objectMapper.readValue(itemsJson, new TypeReference<>() {});
    }

    @Transactional
    public OrderVolumeDto createVolume(Long orderId, OrderVolumeInputDto dto) {
        Order order = getOrderForVolumeChange(orderId);
        OrderVolume volume = new OrderVolume();
        volume.setOrder(order);
        applyVolumeInput(volume, dto);
        order.addVolume(volume);
        orderRepository.saveAndFlush(order);
        return new OrderVolumeDto(volume);
    }

    @Transactional
    public OrderVolumeDto updateVolume(Long orderId, Long volumeId, OrderVolumeInputDto dto) {
        Order order = getOrderForVolumeChange(orderId);
        OrderVolume volume = order.getVolumes().stream()
                .filter(current -> current.getId().equals(volumeId))
                .findFirst()
                .orElseThrow(ResourceNotFoundException::new);

        applyVolumeInput(volume, dto);
        orderRepository.save(order);
        return new OrderVolumeDto(volume);
    }

    @Transactional
    public void deleteVolume(Long orderId, Long volumeId) {
        Order order = getOrderForVolumeChange(orderId);
        boolean removed = order.getVolumes().removeIf(volume -> volume.getId().equals(volumeId));
        if (!removed) throw new ResourceNotFoundException();
        orderRepository.save(order);
    }

    private Order getOrderForVolumeChange(Long orderId) {
        Order order = orderRepository.findById(orderId).orElseThrow(ResourceNotFoundException::new);
        User me = userService.authenticate();

        if (!canInteract(order, me)) {
            throw new ForbiddenException("Usuário não corresponde ao setor competente!");
        }
        if (!order.getCurrentStep().equals(StepType.FINAL_ASSEMBLY)) {
            throw new UnprocessableEntityException("Volumes só podem ser alterados durante a Montagem Final!");
        }
        if (!order.getStatus().equals(OrderStatus.IN_PROGRESS)) {
            throw new UnprocessableEntityException("Não é possível alterar volumes deste pedido!");
        }
        return order;
    }

    private void applyVolumeInput(OrderVolume volume, OrderVolumeInputDto input) {
        if (input.getQuantity() == null || input.getQuantity() < 1) {
            throw new UnprocessableEntityException("Quantidade deve ser um número inteiro maior que zero!");
        }
        volume.setQuantity(input.getQuantity());
        volume.setLength(parseMeasurement(input.getLength(), "Comprimento"));
        volume.setWidth(parseMeasurement(input.getWidth(), "Largura"));
        volume.setHeight(parseMeasurement(input.getHeight(), "Altura"));
        volume.setWeight(parseMeasurement(input.getWeight(), "Peso"));
    }

    public void checkIfHavePictures(Order order) {
        boolean empty = order.getSteps().stream()
                .filter(s -> s.getStep().equals(order.getCurrentStep()))
                .findFirst().orElseThrow(ResourceNotFoundException::new)
                .getPictures()
                .isEmpty();

        if (empty) {
            throw new UnprocessableEntityException("É necessário anexar no mínimo uma imagem!");
        }
    }
}

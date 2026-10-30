package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStep;
import br.com.metaro.portal.modules.general.stepFlow.entities.StepType;
import br.com.metaro.portal.modules.general.stepFlow.entities.StepStatus;
import br.com.metaro.portal.modules.general.stepFlow.entities.StepMessage;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistSnapshotDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistStepBindingDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistStepRequirementDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistStepEquipmentDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistLinkedStepFlowDto;
import br.com.metaro.portal.core.dto.notification.PendingIssuesDto;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChecklistStepFlowService {
    private final ChecklistStepRequirementRepository requirementRepository;
    private final ChecklistStepBindingRepository bindingRepository;
    private final ChecklistStepBindingHistoryRepository bindingHistoryRepository;
    private final ChecklistCategoryRepository categoryRepository;
    private final ChecklistFlowRepository flowRepository;
    private final ChecklistRecordRepository recordRepository;
    private final OrderRepository orderRepository;
    private final UserService userService;
    private final ChecklistMapper mapper;

    @Transactional(readOnly = true)
    public List<ChecklistStepRequirementDto> listRequirements() {
        return requirementRepository.findAll().stream().map(requirement -> {
            ChecklistStepRequirementDto dto = new ChecklistStepRequirementDto();
            dto.setStepType(requirement.getStepType().name());
            dto.setCategoryId(requirement.getCategory().getId());
            return dto;
        }).toList();
    }

    @Transactional
    public ChecklistStepRequirementDto saveRequirement(ChecklistStepRequirementDto dto) {
        User user = userService.authenticate();
        StepType stepType = parseStepType(dto.getStepType());
        ChecklistCategory category = categoryRepository.findById(dto.getCategoryId()).orElseThrow(ResourceNotFoundException::new);
        if (!category.isActive()) throw new UnprocessableEntityException("Uma categoria inativa não pode ser requisito do Fluxo de etapas.");
        ChecklistStepRequirement requirement = requirementRepository.findByStepType(stepType).orElseGet(ChecklistStepRequirement::new);
        requirement.setStepType(stepType);
        requirement.setCategory(category);
        requirement.setUpdatedBy(user);
        requirement.setUpdatedAt(Instant.now());
        requirementRepository.save(requirement);
        return dto;
    }

    @Transactional
    public void removeRequirement(String stepType) {
        requirementRepository.deleteByStepType(parseStepType(stepType));
    }

    @Transactional
    public void replaceBindings(Long orderId, ChecklistStepBindingDto dto) {
        User user = userService.authenticate();
        Set<Long> requested = new TreeSet<>(dto.getFlowIds());
        Map<Long, ChecklistFlow> lockedFlows = new LinkedHashMap<>();
        // Use the same lock order as plate relocation: checklist first, then order.
        for (Long flowId : requested) {
            lockedFlows.put(flowId, flowRepository.findLockedById(flowId).orElseThrow(ResourceNotFoundException::new));
        }
        Order order = orderRepository.findLockedById(orderId).orElseThrow(ResourceNotFoundException::new);
        assertBindingManagementAllowed(order);
        assertEquipmentCapacity(order, requested.size());
        List<ChecklistStepBinding> current = bindingRepository.findByOrderId(orderId);
        current.stream().filter(binding -> !requested.contains(binding.getFlow().getId())).forEach(this::removeBinding);
        for (Long flowId : requested) {
            if (bindingRepository.existsByOrderIdAndFlowId(orderId, flowId)) continue;
            ChecklistFlow flow = lockedFlows.get(flowId);
            validateBinding(order, flow);
            ChecklistStepBinding binding = new ChecklistStepBinding();
            binding.setOrder(order);
            binding.setFlow(flow);
            binding.setCreatedBy(user);
            binding.setCreatedAt(Instant.now());
            bindingRepository.save(binding);
            rememberBinding(binding);
        }
    }

    @Transactional
    public void createBindings(Order order, List<Long> flowIds) {
        if (flowIds == null || flowIds.isEmpty()) return;
        assertEquipmentCapacity(order, new HashSet<>(flowIds).size());

        User user = userService.authenticate();
        for (Long flowId : new TreeSet<>(flowIds)) {
            ChecklistFlow flow = flowRepository.findLockedById(flowId).orElseThrow(ResourceNotFoundException::new);
            validateBinding(order, flow);
            ChecklistStepBinding binding = new ChecklistStepBinding();
            binding.setOrder(order);
            binding.setFlow(flow);
            binding.setCreatedBy(user);
            binding.setCreatedAt(Instant.now());
            bindingRepository.save(binding);
            rememberBinding(binding);
        }
        assertEquipmentCapacity(order);
    }

    @Transactional(readOnly = true)
    public List<ChecklistStepEquipmentDto> listEquipment(Long orderId) {
        Order order = orderRepository.findById(orderId).orElseThrow(ResourceNotFoundException::new);
        List<ChecklistStepBinding> bindings = bindingRepository.findByOrderId(orderId);
        Set<Long> selected = bindings.stream()
                .map(binding -> binding.getFlow().getId())
                .collect(java.util.stream.Collectors.toSet());
        Map<Long, ChecklistFlow> candidates = new LinkedHashMap<>();
        flowRepository.findByOrderNumberAndCancelledFalseOrderBySerialNumberAsc(String.valueOf(order.getNumber())).stream()
                .filter(flow -> recordRepository.existsByFlowIdAndStatus(flow.getId(), ChecklistStatus.FINISHED))
                .filter(flow -> selected.contains(flow.getId())
                        || !bindingRepository.existsByFlowIdAndNonCancelledOrderOtherThan(flow.getId(), orderId))
                .forEach(flow -> candidates.put(flow.getId(), flow));
        bindings.forEach(binding -> candidates.putIfAbsent(binding.getFlow().getId(), binding.getFlow()));
        return candidates.values().stream()
                .sorted(Comparator.comparing(flow -> Objects.requireNonNullElse(flow.getSerialNumber(), "")))
                .map(flow -> {
                    ChecklistStepEquipmentDto dto = toEquipmentDto(flow);
                    dto.setSelected(selected.contains(flow.getId()));
                    return dto;
                }).toList();
    }

    @Transactional(readOnly = true)
    public List<ChecklistLinkedStepFlowDto> listLinkedStepFlows(Long flowId) {
        if (!flowRepository.existsById(flowId)) throw new ResourceNotFoundException();
        Map<Long, ChecklistLinkedStepFlowDto> result = new LinkedHashMap<>();
        for (ChecklistStepBindingHistory history : bindingHistoryRepository.findByFlowIdOrderByIdAsc(flowId)) {
            result.put(history.getOrder().getId(), linkedStepDto(history.getOrder(), history.getOrderNumber(), false));
        }
        for (ChecklistStepBinding binding : bindingRepository.findByFlowId(flowId)) {
            result.put(binding.getOrder().getId(), linkedStepDto(binding.getOrder(), binding.getOrder().getDisplayNumber(), binding.getOrder().getStatus() != OrderStatus.CANCELLED));
        }
        return result.values().stream().sorted(Comparator.comparing(ChecklistLinkedStepFlowDto::getId)).toList();
    }

    @Transactional(readOnly = true)
    public List<ChecklistStepEquipmentDto> listAvailableEquipment(String orderNumber) {
        return flowRepository.findByOrderNumberAndCancelledFalseOrderBySerialNumberAsc(orderNumber).stream()
                .filter(flow -> recordRepository.existsByFlowIdAndStatus(flow.getId(), ChecklistStatus.FINISHED))
                .filter(flow -> !bindingRepository.existsByFlowIdAndNonCancelledOrder(flow.getId()))
                .map(this::toEquipmentDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public void assertOrderCanStart(String orderNumber) {
        boolean available = flowRepository.findByOrderNumberAndCancelledFalseOrderBySerialNumberAsc(orderNumber).stream()
                .anyMatch(flow -> recordRepository.existsByFlowIdAndStatus(flow.getId(), ChecklistStatus.FINISHED)
                        && !bindingRepository.existsByFlowIdAndNonCancelledOrder(flow.getId()));
        if (!available) {
            throw new UnprocessableEntityException("O pedido precisa possuir ao menos um equipamento com checklist finalizado.");
        }
    }

    @Transactional(readOnly = true)
    public boolean isStepRequirementSatisfied(Long orderId, StepType stepType) {
        ChecklistStepRequirement requirement = requirementRepository.findByStepType(stepType).orElse(null);
        if (requirement == null) return true;
        List<ChecklistStepBinding> bindings = bindingRepository.findByOrderId(orderId);
        if (bindings.isEmpty()) return true;
        return bindings.stream().allMatch(binding -> isCategoryFinished(binding.getFlow(), requirement.getCategory().getId()));
    }

    @Transactional
    public Order lockForReopening(Long orderId) {
        List<ChecklistStepBinding> bindings = bindingRepository.findByOrderId(orderId);
        lockFlows(bindings.stream().map(binding -> binding.getFlow().getId()).sorted().toList());
        Order order = orderRepository.findLockedById(orderId).orElseThrow(ResourceNotFoundException::new);
        for (ChecklistStepBinding binding : bindings) validateBinding(order, binding.getFlow());
        assertEquipmentCapacity(order, bindings.size());
        return order;
    }

    @Transactional
    public void completeWaitingSteps(Long flowId, User user) {
        for (ChecklistStepBinding binding : bindingRepository.findByFlowId(flowId)) {
            Order order = binding.getOrder();
            if (!order.isChecklistIntegration() || order.getStatus() != OrderStatus.IN_PROGRESS || order.getCurrentStep() == null) continue;
            OrderStep current = order.getSteps().stream()
                    .filter(step -> step.getStep() == order.getCurrentStep())
                    .findFirst().orElse(null);
            if (current == null || !current.isChecklistPending() || !isStepRequirementSatisfied(order.getId(), order.getCurrentStep())) continue;
            StepType completedType = order.getCurrentStep();
            current.setChecklistPending(false);
            current.setStatus(StepStatus.DONE);
            current.setFinishedAt(Instant.now());
            current.setFinishedBy(user);
            if (completedType == StepType.SHIPPING) {
                order.setStatus(OrderStatus.COMPLETED);
            } else {
                StepType nextType = StepType.values()[completedType.ordinal() + 1];
                OrderStep next = order.getSteps().stream().filter(step -> step.getStep() == nextType).findFirst().orElseThrow(ResourceNotFoundException::new);
                order.setCurrentStep(nextType);
                next.setStatus(StepStatus.ACTIVE);
                next.setStartedAt(Instant.now());
            }
            orderRepository.save(order);
        }
    }

    @Transactional(readOnly = true)
    public List<PendingIssuesDto> listAlerts() {
        User user = userService.authenticate();
        boolean operator = user.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("ROLE_CHECKLIST_OPERATOR"));
        if (!operator) return List.of();
        Map<Long, PendingIssuesDto> alerts = new LinkedHashMap<>();
        for (ChecklistStepBinding binding : bindingRepository.findByOrderStatusNot(OrderStatus.CANCELLED)) {
            StepType currentStep = binding.getOrder().getCurrentStep();
            ChecklistStepRequirement requirement = currentStep == null ? null : requirementRepository.findByStepType(currentStep).orElse(null);
            if (requirement == null || requirement.getCategory().getOperators().stream()
                    .noneMatch(authorized -> authorized.getId().equals(user.getId()))) continue;
            if (isCategoryFinished(binding.getFlow(), requirement.getCategory().getId())) continue;
            Order order = binding.getOrder();
            alerts.putIfAbsent(order.getId(), new PendingIssuesDto(
                    order.getId(),
                    "Fluxo de etapas do pedido " + order.getDisplayNumber(),
                    "Finalize o checklist da categoria " + requirement.getCategory().getName() + ".",
                    "pending"
            ));
        }
        return new ArrayList<>(alerts.values());
    }

    @Transactional(readOnly = true)
    public void assertStepCanFinish(Long orderId, StepType stepType) {
        ChecklistStepRequirement requirement = requirementRepository.findByStepType(stepType).orElse(null);
        if (requirement == null) return;
        List<ChecklistStepBinding> bindings = bindingRepository.findByOrderId(orderId);
        if (bindings.isEmpty()) return;
        for (ChecklistStepBinding binding : bindings) {
            if (!isCategoryFinished(binding.getFlow(), requirement.getCategory().getId())) {
                throw new UnprocessableEntityException("Todos os equipamentos selecionados devem finalizar a categoria de checklist exigida antes que esta etapa possa avançar.");
            }
        }
    }

    @Transactional(readOnly = true)
    public boolean hasActiveDependency(Long flowId) {
        return bindingRepository.existsByFlowIdAndNonCancelledOrder(flowId);
    }

    @Transactional(readOnly = true)
    public boolean categoryIsRequired(Long categoryId) {
        return requirementRepository.existsByCategoryId(categoryId);
    }

    private boolean isCategoryFinished(ChecklistFlow flow, Long categoryId) {
        List<ChecklistSnapshotDto> plan = mapper.read(flow.getPlanJson(), new TypeReference<>() {});
        ChecklistSnapshotDto required = plan.stream().filter(snapshot -> snapshot.getCategory().getId().equals(categoryId)).findFirst().orElse(null);
        if (required == null) return false;
        Map<String, String> skipped = mapper.read(flow.getSkippedJson(), new TypeReference<>() {});
        if (skipped.containsKey(required.getTemplate().getId().toString())) return !flow.isCancelled();
        ChecklistRecord record = recordRepository.findByFlowIdAndTemplateId(flow.getId(), required.getTemplate().getId()).orElse(null);
        return !flow.isCancelled() && record != null && record.getStatus() == ChecklistStatus.FINISHED;
    }

    @Transactional
    public void lockFlows(List<Long> flowIds) {
        for (Long flowId : new TreeSet<>(flowIds)) {
            flowRepository.findLockedById(flowId).orElseThrow(ResourceNotFoundException::new);
        }
    }

    public void assertBindingManagementAllowed(Order order) {
        if (order.getCurrentStep() != StepType.FINAL_ASSEMBLY || order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.COMPLETED) {
            throw new UnprocessableEntityException("Os checklists vinculados só podem ser gerenciados na etapa Montagem Final de um fluxo aberto.");
        }
    }

    @Transactional(readOnly = true)
    public void assertEquipmentCapacity(Order order) {
        assertEquipmentCapacity(order, bindingRepository.countByOrderId(order.getId()));
    }

    private void assertEquipmentCapacity(Order order, long selectedCount) {
        long productionQuantity = order.getItems().stream()
                .mapToLong(item -> item.getProducedQuantity() == null ? 0 : Math.max(0, item.getProducedQuantity()))
                .sum();
        if (selectedCount > productionQuantity) {
            throw new UnprocessableEntityException("A quantidade de equipamentos vinculados não pode ultrapassar a quantidade de itens a produzir (" + productionQuantity + ").");
        }
    }

    private void validateBinding(Order order, ChecklistFlow flow) {
        if (flow.isCancelled()) throw new UnprocessableEntityException("Fluxos de checklist cancelados não podem ser vinculados ao Fluxo de etapas.");
        if (!Objects.equals(String.valueOf(order.getNumber()), flow.getOrderNumber())) {
            throw new UnprocessableEntityException("O equipamento do checklist pertence a outro pedido.");
        }
        if (!recordRepository.existsByFlowIdAndStatus(flow.getId(), ChecklistStatus.FINISHED)) {
            throw new UnprocessableEntityException("O equipamento precisa ter um checklist finalizado antes de iniciar o Fluxo de etapas.");
        }
        if (bindingRepository.existsByFlowIdAndNonCancelledOrderOtherThan(flow.getId(), order.getId())) {
            throw new UnprocessableEntityException("O equipamento do checklist já pertence a outro Fluxo de etapas não cancelado.");
        }
    }

    private ChecklistStepEquipmentDto toEquipmentDto(ChecklistFlow flow) {
        ChecklistStepEquipmentDto dto = new ChecklistStepEquipmentDto();
        dto.setFlowId(flow.getId());
        recordRepository.findFirstByFlowIdOrderByIdAsc(flow.getId()).ifPresent(record -> dto.setRecordId(record.getId()));
        dto.setSerial(flow.getSerialNumber());
        dto.setItem(flow.getCommercialItem());
        return dto;
    }

    @Transactional
    public void relocateEquipment(ChecklistFlow flow, String newOrder, User actor) {
        for (ChecklistStepBinding binding : bindingRepository.findByFlowId(flow.getId())) {
            Order order = orderRepository.findLockedById(binding.getOrder().getId()).orElseThrow(ResourceNotFoundException::new);
            OrderStep current = order.getSteps().stream()
                    .filter(step -> step.getStep() == (order.getStatus() == OrderStatus.COMPLETED ? StepType.SHIPPING : order.getCurrentStep()))
                    .findFirst().orElseThrow(ResourceNotFoundException::new);
            String destination = newOrder == null || newOrder.isBlank() ? "Pronta Entrega" : "o pedido " + newOrder;
            current.getMessages().add(new StepMessage(
                    "O número de série " + flow.getSerialNumber() + " foi realocado para " + destination + " pelo setor PCP.", current, actor));
            removeBinding(binding);
            orderRepository.save(order);
        }
    }

    private ChecklistLinkedStepFlowDto linkedStepDto(Order order, String number, boolean linked) {
        ChecklistLinkedStepFlowDto dto = new ChecklistLinkedStepFlowDto();
        dto.setId(order.getId());
        dto.setOrder(number);
        dto.setStatus(order.getStatus().toString());
        dto.setCurrentStep(order.getCurrentStep() == null ? null : order.getCurrentStep().toString());
        dto.setLinked(linked);
        return dto;
    }

    private void rememberBinding(ChecklistStepBinding binding) {
        ChecklistStepBindingHistory history = new ChecklistStepBindingHistory();
        history.setOrder(binding.getOrder());
        history.setFlow(binding.getFlow());
        history.setOrderNumber(binding.getOrder().getDisplayNumber());
        history.setLinkedAt(binding.getCreatedAt());
        bindingHistoryRepository.save(history);
    }

    private void removeBinding(ChecklistStepBinding binding) {
        List<ChecklistStepBindingHistory> history = bindingHistoryRepository.findByOrderIdAndFlowIdAndUnlinkedAtIsNull(binding.getOrder().getId(), binding.getFlow().getId());
        if (history.isEmpty()) {
            rememberBinding(binding);
            history = bindingHistoryRepository.findByOrderIdAndFlowIdAndUnlinkedAtIsNull(binding.getOrder().getId(), binding.getFlow().getId());
        }
        Instant now = Instant.now();
        history.forEach(item -> item.setUnlinkedAt(now));
        bindingHistoryRepository.saveAll(history);
        bindingRepository.delete(binding);
    }

    private StepType parseStepType(String value) {
        try {
            return StepType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (RuntimeException exception) {
            throw new UnprocessableEntityException("Tipo de Fluxo de etapas inválido.");
        }
    }
}

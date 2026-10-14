package br.com.metaro.portal.modules.general.stepFlow.service;

import br.com.metaro.portal.modules.general.stepFlow.dto.OrderDto;
import br.com.metaro.portal.modules.general.stepFlow.dto.OrderInputDto;
import br.com.metaro.portal.modules.general.stepFlow.dto.OrderMinDto;
import br.com.metaro.portal.modules.general.stepFlow.dto.OrderVolumeInputDto;
import br.com.metaro.portal.core.entities.Role;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.stepFlow.entities.*;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import br.com.metaro.portal.util.picture.Picture;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StepFlowServiceTests {

    @Test
    void addsOccurrenceSuffixFromSecondRegistrationOnwards() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        StepFlowService service = new StepFlowService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        when(orderRepository.countByNumber(14064)).thenReturn(1L);

        service.create(erpOrder(14064));

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(captor.capture());
        Order savedOrder = captor.getValue();

        assertThat(savedOrder.getNumber()).isEqualTo(14064);
        assertThat(savedOrder.getOccurrence()).isEqualTo(2);
        assertThat(new OrderMinDto(savedOrder).getNumber()).isEqualTo("14064-2");
        assertThat(new OrderDto(savedOrder).getNumber()).isEqualTo("14064-2");
    }

    @Test
    void keepsFirstRegistrationWithoutSuffix() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        StepFlowService service = new StepFlowService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        when(orderRepository.countByNumber(14064)).thenReturn(0L);

        service.create(erpOrder(14064));

        ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
        verify(orderRepository).save(captor.capture());

        assertThat(captor.getValue().getDisplayNumber()).isEqualTo("14064");
    }

    @Test
    void usesEffectiveStatusSortForThePaginatedList() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        StepFlowService service = new StepFlowService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        when(orderRepository.searchOrderByEffectiveStatus(any(Pageable.class), eq(""), eq(1)))
                .thenReturn(Page.empty());

        service.listOrders(
                PageRequest.of(0, 30, Sort.by(Sort.Direction.ASC, "status")),
                null,
                null
        );

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(orderRepository).searchOrderByEffectiveStatus(pageableCaptor.capture(), eq(""), eq(1));
        assertThat(pageableCaptor.getValue().getSort().getOrderFor("status")).isNull();
        assertThat(pageableCaptor.getValue().getSort().toList())
                .containsExactly(Sort.Order.desc("id"));
    }

    @Test
    void appendsDescendingIdAfterTheRequestedSorts() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        StepFlowService service = new StepFlowService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        when(orderRepository.search(any(Pageable.class), eq(""))).thenReturn(Page.empty());

        service.listOrders(
                PageRequest.of(0, 30, Sort.by(Sort.Direction.ASC, "client")
                        .and(Sort.by(Sort.Direction.ASC, "id"))),
                null,
                null
        );

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(orderRepository).search(pageableCaptor.capture(), eq(""));
        assertThat(pageableCaptor.getValue().getSort().toList()).containsExactly(
                Sort.Order.asc("client"),
                Sort.Order.desc("id")
        );
    }

    @Test
    void usesEffectiveStatusSortWithStepFilter() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        StepFlowService service = new StepFlowService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        when(orderRepository.searchOnlyStepOrderByEffectiveStatus(
                any(Pageable.class),
                eq(""),
                eq("PCP"),
                any(),
                eq(-1)
        )).thenReturn(Page.empty());

        service.listOrders(
                PageRequest.of(0, 30, Sort.by(Sort.Direction.DESC, "status")),
                null,
                "PCP"
        );

        verify(orderRepository).searchOnlyStepOrderByEffectiveStatus(
                any(Pageable.class),
                eq(""),
                eq("PCP"),
                any(),
                eq(-1)
        );
    }

    @Test
    void requiresAtLeastOneVolumeToLeaveFinalAssembly() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        UserService userService = mock(UserService.class);
        StepFlowService service = serviceWith(orderRepository, userService);
        Order order = finalAssemblyOrder();

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(userService.authenticate()).thenReturn(new User());

        assertThatThrownBy(() -> service.goToNextStep(1L))
                .isInstanceOf(UnprocessableEntityException.class)
                .hasMessage("Cadastre ao menos um volume antes de avançar!");
    }

    @Test
    void allowsAdministratorToLeaveFinalAssemblyWithoutVolumes() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        UserService userService = mock(UserService.class);
        StepFlowService service = serviceWith(orderRepository, userService);
        Order order = finalAssemblyOrder();
        User administrator = new User();
        Role adminRole = new Role();
        adminRole.setAuthority("ROLE_ADMIN");
        administrator.addRole(adminRole);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(userService.authenticate()).thenReturn(administrator);

        service.goToNextStep(1L);

        assertThat(order.getCurrentStep()).isEqualTo(StepType.PCP);
        verify(orderRepository).save(order);
    }

    @Test
    void persistsVolumeChangesIndependentlyFromTheStepForm() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        UserService userService = mock(UserService.class);
        StepFlowService service = serviceWith(orderRepository, userService);
        Order order = finalAssemblyOrder();
        User administrator = new User();
        Role adminRole = new Role();
        adminRole.setAuthority("ROLE_ADMIN");
        administrator.addRole(adminRole);

        when(orderRepository.findById(1L)).thenReturn(Optional.of(order));
        when(orderRepository.saveAndFlush(order)).thenReturn(order);
        when(userService.authenticate()).thenReturn(administrator);

        service.createVolume(1L, new OrderVolumeInputDto(null, 2, "1.20", "0.80", "0.50", "12.35"));

        assertThat(order.getVolumes()).hasSize(1);
        assertThat(order.getVolumes().getFirst().getQuantity()).isEqualTo(2);
        verify(orderRepository).saveAndFlush(order);

        order.getVolumes().getFirst().setId(10L);
        service.deleteVolume(1L, 10L);

        assertThat(order.getVolumes()).isEmpty();
        verify(orderRepository).save(order);
    }

    @Test
    void administratorCanAdvanceAndCompletesSkippedStepsWithAudit() {
        OrderRepository orderRepository = mock(OrderRepository.class);
        UserService userService = mock(UserService.class);
        StepFlowService service = serviceWith(orderRepository, userService);
        User administrator = new User();
        administrator.setName("Administrador");
        Role adminRole = new Role();
        adminRole.setAuthority("ROLE_ADMIN");
        administrator.addRole(adminRole);

        Instant originalStart = Instant.parse("2026-10-14T10:00:00Z");
        Order order = orderWithAllSteps(originalStart);
        OrderInputDto input = new OrderInputDto();
        input.setNewStepId(StepType.BILLING.ordinal());
        when(userService.authenticate()).thenReturn(administrator);

        ReflectionTestUtils.invokeMethod(service, "rulesForUpdate", input, order);

        assertThat(order.getCurrentStep()).isEqualTo(StepType.BILLING);

        OrderStep finalAssembly = order.getSteps().get(0);
        assertThat(finalAssembly.getStatus()).isEqualTo(StepStatus.DONE);
        assertThat(finalAssembly.getStartedAt()).isEqualTo(originalStart);
        assertThat(finalAssembly.getFinishedAt()).isNotNull();
        assertThat(finalAssembly.getFinishedBy()).isSameAs(administrator);

        for (OrderStep skippedStep : order.getSteps().subList(1, 3)) {
            assertThat(skippedStep.getStatus()).isEqualTo(StepStatus.DONE);
            assertThat(skippedStep.getStartedAt()).isNotNull();
            assertThat(skippedStep.getFinishedAt()).isEqualTo(skippedStep.getStartedAt());
            assertThat(skippedStep.getFinishedBy()).isSameAs(administrator);
        }

        OrderStep billing = order.getSteps().get(3);
        assertThat(billing.getStatus()).isEqualTo(StepStatus.ACTIVE);
        assertThat(billing.getStartedAt()).isNotNull();
        assertThat(billing.getFinishedAt()).isNull();
        assertThat(billing.getFinishedBy()).isNull();
        assertThat(order.getSteps().get(4).getStatus()).isEqualTo(StepStatus.WAITING);
    }

    private StepFlowService serviceWith(OrderRepository orderRepository, UserService userService) {
        StepFlowService service = new StepFlowService();
        ReflectionTestUtils.setField(service, "orderRepository", orderRepository);
        ReflectionTestUtils.setField(service, "userService", userService);
        return service;
    }

    private Order finalAssemblyOrder() {
        Order order = new Order();
        order.setId(1L);
        order.setStatus(OrderStatus.IN_PROGRESS);
        order.setCurrentStep(StepType.FINAL_ASSEMBLY);
        order.setVolumes(new ArrayList<>());

        OrderStep finalAssembly = new OrderStep();
        finalAssembly.setStep(StepType.FINAL_ASSEMBLY);
        finalAssembly.setStatus(StepStatus.ACTIVE);
        finalAssembly.setPictures(new ArrayList<>(List.of(new Picture())));

        OrderStep pcp = new OrderStep();
        pcp.setStep(StepType.PCP);
        pcp.setStatus(StepStatus.WAITING);
        order.setSteps(new ArrayList<>(List.of(finalAssembly, pcp)));
        return order;
    }

    private Order orderWithAllSteps(Instant finalAssemblyStart) {
        Order order = new Order();
        order.setId(1L);
        order.setStatus(OrderStatus.IN_PROGRESS);
        order.setCurrentStep(StepType.FINAL_ASSEMBLY);

        List<OrderStep> steps = new ArrayList<>();
        for (StepType stepType : StepType.values()) {
            OrderStep step = new OrderStep();
            step.setStep(stepType);
            step.setStatus(stepType == StepType.FINAL_ASSEMBLY ? StepStatus.ACTIVE : StepStatus.WAITING);
            step.setOrder(order);
            steps.add(step);
        }
        steps.getFirst().setStartedAt(finalAssemblyStart);
        order.setSteps(steps);
        return order;
    }

    private ErpOrderDto erpOrder(int number) {
        return new ErpOrderDto(
                number,
                "Cliente",
                null,
                null,
                null,
                null,
                null,
                null,
                100.0,
                0.0,
                100.0
        );
    }
}

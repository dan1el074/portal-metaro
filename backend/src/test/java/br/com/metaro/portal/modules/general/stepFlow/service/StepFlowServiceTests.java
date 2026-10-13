package br.com.metaro.portal.modules.general.stepFlow.service;

import br.com.metaro.portal.modules.general.stepFlow.dto.OrderDto;
import br.com.metaro.portal.modules.general.stepFlow.dto.OrderMinDto;
import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistStepFlowService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
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
        ReflectionTestUtils.setField(service, "checklistStepFlowService", mock(ChecklistStepFlowService.class));
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
        ReflectionTestUtils.setField(service, "checklistStepFlowService", mock(ChecklistStepFlowService.class));
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

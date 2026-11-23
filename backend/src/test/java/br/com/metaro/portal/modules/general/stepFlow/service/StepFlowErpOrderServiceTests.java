package br.com.metaro.portal.modules.general.stepFlow.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.integration.focco.FoccoOrderClient;
import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderItem;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import br.com.metaro.portal.util.erp.ErpOrderQueryService;
import br.com.metaro.portal.util.erp.ErpSource;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import br.com.metaro.portal.util.erp.dto.ErpOrderItemDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StepFlowErpOrderServiceTests {
    private UserService userService;
    private ErpOrderQueryService erpOrderQueryService;
    private OrderRepository orderRepository;
    private FoccoOrderClient foccoOrderClient;
    private StepFlowErpOrderService service;

    @BeforeEach
    void setUp() {
        userService = mock(UserService.class);
        erpOrderQueryService = mock(ErpOrderQueryService.class);
        orderRepository = mock(OrderRepository.class);
        foccoOrderClient = mock(FoccoOrderClient.class);

        User authenticatedUser = new User();
        when(userService.authenticate()).thenReturn(authenticatedUser);

        service = new StepFlowErpOrderService(
                userService,
                erpOrderQueryService,
                orderRepository,
                foccoOrderClient
        );
    }

    @Test
    void addsQuantitiesAlreadyProducedLocally() {
        ErpOrderDto erpOrder = createErpOrder(10);
        Order localOrder = createLocalOrder(4);
        when(erpOrderQueryService.findProductionOrderByNumber(14064))
                .thenReturn(Optional.of(erpOrder));
        when(orderRepository.findByNumberAndErpSource(14064, ErpSource.PROBUS, OrderStatus.CANCELLED))
                .thenReturn(List.of(localOrder));

        ErpOrderDto result = service.findAvailableOrderByNumber(14064, ErpSource.PROBUS);

        assertThat(result.getItems().getFirst().getProducedQuantity())
                .isEqualTo(4);
    }

    @Test
    void rejectsAnOrderThatWasFullyProduced() {
        ErpOrderDto erpOrder = createErpOrder(10);
        Order localOrder = createLocalOrder(10);
        when(erpOrderQueryService.findProductionOrderByNumber(14064))
                .thenReturn(Optional.of(erpOrder));
        when(orderRepository.findByNumberAndErpSource(14064, ErpSource.PROBUS, OrderStatus.CANCELLED))
                .thenReturn(List.of(localOrder));

        assertThatThrownBy(() -> service.findAvailableOrderByNumber(14064, ErpSource.PROBUS))
                .isInstanceOf(UnprocessableEntityException.class);
    }

    @Test
    void usesFoccoClientWhenFoccoIsSelected() {
        ErpOrderDto erpOrder = createErpOrder(10);
        when(foccoOrderClient.findProductionOrderByNumber(149)).thenReturn(erpOrder);
        when(orderRepository.findByNumberAndErpSource(149, ErpSource.FOCCO, OrderStatus.CANCELLED))
                .thenReturn(List.of());

        ErpOrderDto result = service.findAvailableOrderByNumber(149, ErpSource.FOCCO);

        assertThat(result.getSource()).isEqualTo(ErpSource.FOCCO);
    }

    @Test
    void reprocessesUsingTheOriginalSourceWithoutLocalAvailabilityRules() {
        var focco = createErpOrder(10);
        focco.getItems().getFirst().addProducedQuantity(10);
        when(foccoOrderClient.findProductionOrderByNumber(14064)).thenReturn(focco);
        assertThat(service.findOrderForReprocessing(14064, ErpSource.FOCCO).getSource()).isEqualTo(ErpSource.FOCCO);
        var probus = createErpOrder(10);
        when(erpOrderQueryService.findProductionOrderByNumberWithoutRules(14064)).thenReturn(Optional.of(probus));
        assertThat(service.findOrderForReprocessing(14064, ErpSource.PROBUS).getSource()).isEqualTo(ErpSource.PROBUS);
        org.mockito.Mockito.verifyNoInteractions(orderRepository);
    }

    @Test
    void rejectsAnEmptyErpOrderBeforeReplacingLocalItems() {
        var empty = createErpOrder(10); empty.getItems().clear();
        when(foccoOrderClient.findProductionOrderByNumber(14064)).thenReturn(empty);
        assertThatThrownBy(() -> service.findOrderForReprocessing(14064, ErpSource.FOCCO)).isInstanceOf(UnprocessableEntityException.class);
    }

    private ErpOrderDto createErpOrder(int quantity) {
        ErpOrderDto order = new ErpOrderDto(
                14064,
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
        order.addItem(new ErpOrderItemDto(
                "ITEM-1",
                "Item",
                10.0,
                "un",
                quantity,
                0
        ));
        return order;
    }

    private Order createLocalOrder(int producedQuantity) {
        OrderItem item = new OrderItem();
        item.setItemCode("ITEM-1");
        item.setProducedQuantity(producedQuantity);

        Order order = new Order();
        order.setItems(List.of(item));
        return order;
    }
}

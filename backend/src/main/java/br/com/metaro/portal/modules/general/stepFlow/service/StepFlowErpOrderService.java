package br.com.metaro.portal.modules.general.stepFlow.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus;
import br.com.metaro.portal.modules.general.stepFlow.repositories.OrderRepository;
import br.com.metaro.portal.integration.focco.FoccoOrderClient;
import br.com.metaro.portal.util.erp.ErpSource;
import br.com.metaro.portal.util.erp.ErpOrderQueryService;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import br.com.metaro.portal.util.erp.dto.ErpOrderItemDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class StepFlowErpOrderService {
    private final UserService userService;
    private final ErpOrderQueryService erpOrderQueryService;
    private final OrderRepository orderRepository;
    private final FoccoOrderClient foccoOrderClient;

    @Transactional(readOnly = true)
    public ErpOrderDto findOrderForReprocessing(int number, ErpSource source) {
        ErpOrderDto order = source == ErpSource.FOCCO
                ? foccoOrderClient.findProductionOrderByNumber(number)
                : erpOrderQueryService.findProductionOrderByNumberWithoutRules(number).orElseThrow(ResourceNotFoundException::new);
        order.setSource(source);
        if (order.getItems() == null || order.getItems().isEmpty()) {
            throw new UnprocessableEntityException("O pedido retornado pelo ERP não possui itens para reprocessar.");
        }
        return order;
    }

    @Transactional(readOnly = true)
    public ErpOrderDto findAvailableOrderByNumber(int orderNumber, ErpSource source) {
        User me = userService.authenticate();
        boolean isAdmin = me.getAuthorities().stream().anyMatch(a -> a
                .getAuthority().equals("ROLE_ADMIN"));

        ErpOrderDto orderFromErp;

        if (source == ErpSource.FOCCO) {
            orderFromErp = foccoOrderClient.findProductionOrderByNumber(orderNumber);
        } else if (isAdmin) {
            orderFromErp = erpOrderQueryService.findProductionOrderByNumberWithoutRules(orderNumber)
                .orElseThrow(ResourceNotFoundException::new);
        } else {
            orderFromErp = erpOrderQueryService.findProductionOrderByNumber(orderNumber)
                .orElseThrow(ResourceNotFoundException::new);
        }

        orderFromErp.setSource(source);
        List<Order> localOrders = orderRepository.findByNumberAndErpSource(
                orderNumber,
                source,
                OrderStatus.CANCELLED
        );

        addLocallyProducedQuantities(orderFromErp, localOrders);
        ensureOrderHasPendingProduction(orderFromErp);

        return orderFromErp;
    }

    private void addLocallyProducedQuantities( ErpOrderDto orderFromErp,  List<Order> localOrders) {
        for (Order localOrder : localOrders) {
            for (ErpOrderItemDto itemFromErp : orderFromErp.getItems()) {
                Integer producedQuantity = localOrder.getItems()
                        .stream()
                        .filter(item -> item.getItemCode().equals(itemFromErp.getCode()))
                        .findFirst()
                        .orElseThrow(ResourceNotFoundException::new)
                        .getProducedQuantity();

                itemFromErp.addProducedQuantity(producedQuantity);
            }
        }
    }

    private void ensureOrderHasPendingProduction(ErpOrderDto orderFromErp) {
        boolean fullyProduced = orderFromErp.getItems()
                .stream()
                .allMatch(item -> item.getProducedQuantity().equals(item.getQuantity()));

        if (fullyProduced) throw new UnprocessableEntityException("Pedido não disponível para produção!");
    }
}

package br.com.metaro.portal.util.erp;

import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import br.com.metaro.portal.util.erp.dto.ErpOrderLineDto;
import br.com.metaro.portal.integration.focco.FoccoOrderClient;
import br.com.metaro.portal.integration.probus.ProbusOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ErpOrderQueryService {
    private final ProbusOrderRepository probusOrderRepository;
    private final FoccoOrderClient foccoOrderClient;

    public Optional<ErpOrderDto> findProductionOrderByNumber(int orderNumber) {
        return probusOrderRepository.findProductionOrderByNumber(orderNumber);
    }

    public Optional<ErpOrderDto> findProductionOrderByNumberWithoutRules(int orderNumber) {
        return probusOrderRepository.findProductionOrderByNumberWithoutRules(orderNumber);
    }

    public Optional<ErpOrderDto> findProductionOrderByNumber(int orderNumber, ErpSource source) {
        if (source == ErpSource.FOCCO) {
            return Optional.of(foccoOrderClient.findProductionOrderByNumber(orderNumber));
        }
        return findProductionOrderByNumber(orderNumber);
    }

    public List<ErpOrderLineDto> findOrderLinesByNumber(int orderNumber) {
        return probusOrderRepository.findOrderLinesByNumber(orderNumber);
    }

    public List<ErpOrderLineDto> findOrderLinesByNumber(int orderNumber, ErpSource source) {
        if (source == ErpSource.FOCCO) {
            return foccoOrderClient.findOrderLinesByNumber(orderNumber);
        }
        return findOrderLinesByNumber(orderNumber);
    }
}

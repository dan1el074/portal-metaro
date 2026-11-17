package br.com.metaro.portal.modules.pcp.serialplates.service;

import br.com.metaro.portal.integration.focco.FoccoPlateClient;
import br.com.metaro.portal.integration.focco.FoccoIntegrationException;
import br.com.metaro.portal.integration.focco.dto.FoccoPlateLineDto;
import br.com.metaro.portal.modules.pcp.serialplates.dto.*;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SerialPlateErpService {
    private final FoccoPlateClient client;

    public SerialPlateOrderDto findOrder(String number) {
        if (number == null || !number.matches("[0-9]{1,15}")) throw new UnprocessableEntityException("Informe um número de pedido válido.");
        List<FoccoPlateLineDto> lines = client.findPlateOrder(Long.parseLong(number));
        if (lines.isEmpty()) throw new UnprocessableEntityException("Pedido não encontrado no FoccoERP.");
        String customer = text(lines.getFirst().getClient());
        Map<String, SerialPlateOrderItemDto> items = new LinkedHashMap<>();
        for (FoccoPlateLineDto line : lines) {
            if (!Objects.equals(line.getOrderNumber(), Long.valueOf(number)) || !customer.equals(text(line.getClient()))) {
                throw new FoccoIntegrationException("O FoccoERP retornou dados inconsistentes para o pedido.");
            }
            SerialPlateOrderItemDto item = new SerialPlateOrderItemDto();
            item.setItemCode(text(line.getItemCode()));
            if (item.getItemCode().isEmpty() || item.getItemCode().length() > 64) {
                throw new FoccoIntegrationException("O FoccoERP não retornou um código de item válido para o pedido.");
            }
            item.setDescription(text(line.getModel()));
            item.setOrderDescription(text(line.getDescription()));
            item.setLabel(text(line.getDescription()) + " — " + item.getDescription());
            item.setVoltage(text(line.getVoltage()));
            item.setCapacity(decimal(line.getCapacity(), "TON"));
            item.setWeight(decimal(line.getWeight(), "KG"));
            SerialPlateOrderItemDto previous = items.putIfAbsent(item.getItemCode(), item);
            if (previous != null && !sameConfiguration(previous, item)) {
                throw new FoccoIntegrationException("O FoccoERP retornou configurações diferentes para o mesmo código de item: " + item.getItemCode() + ".");
            }
        }
        return new SerialPlateOrderDto(customer, new ArrayList<>(items.values()));
    }

    private boolean sameConfiguration(SerialPlateOrderItemDto first, SerialPlateOrderItemDto second) {
        return Objects.equals(first.getDescription(), second.getDescription())
                && Objects.equals(first.getOrderDescription(), second.getOrderDescription())
                && Objects.equals(first.getVoltage(), second.getVoltage())
                && Objects.equals(first.getCapacity(), second.getCapacity())
                && Objects.equals(first.getWeight(), second.getWeight());
    }

    private BigDecimal decimal(String value, String unit) {
        if (value == null || value.isBlank()) return null;
        String number = value.trim().toUpperCase(Locale.ROOT).replaceFirst("\\s*" + unit + "$", "").trim();
        if (number.contains(",")) number = number.replace(".", "").replace(',', '.');
        try {
            BigDecimal result = new BigDecimal(number);
            if (result.signum() <= 0 || result.scale() > 6 || result.precision() - result.scale() > 12) throw new NumberFormatException();
            return result.stripTrailingZeros();
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String text(String value) {
        return value == null ? "" : value.trim();
    }
}

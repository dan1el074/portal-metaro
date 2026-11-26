package br.com.metaro.portal.modules.pcp.serialplates.service;

import br.com.metaro.portal.util.erp.ErpItemCode;
import br.com.metaro.portal.integration.focco.FoccoPlateClient;
import br.com.metaro.portal.integration.focco.FoccoIntegrationException;
import br.com.metaro.portal.integration.focco.dto.FoccoPlateLineDto;
import br.com.metaro.portal.modules.pcp.serialplates.dto.*;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
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
            item.setItemCode(ErpItemCode.normalize(line.getItemCode()));
            if (item.getItemCode().isEmpty() || item.getItemCode().length() > 64) {
                throw new FoccoIntegrationException("O FoccoERP não retornou um código de item válido para o pedido.");
            }
            item.setDescription(text(line.getModel()));
            item.setOrderDescription(text(line.getDescription()));
            item.setLabel(text(line.getDescription()) + " — " + item.getDescription());
            item.setVoltage(text(line.getVoltage()));
            item.setCapacity(decimal(line.getCapacity(), "TON"));
            item.setWeight(decimal(line.getWeight(), "KG"));
            item.setSelectionKey(configurationKey(item));
            items.putIfAbsent(item.getSelectionKey(), item);
        }
        for (SerialPlateOrderItemDto item : items.values()) {
            if (items.values().stream().filter(other -> other.getItemCode().equals(item.getItemCode())).count() > 1) {
                item.setLabel(item.getLabel() + " | " + (item.getCapacity() == null ? "-" : item.getCapacity().toPlainString() + " t")
                        + " | " + (item.getVoltage().isEmpty() ? "-" : item.getVoltage())
                        + " | " + (item.getWeight() == null ? "-" : item.getWeight().toPlainString() + " kg"));
            }
        }
        return new SerialPlateOrderDto(customer, new ArrayList<>(items.values()));
    }

    private String configurationKey(SerialPlateOrderItemDto item) {
        StringBuilder key = new StringBuilder();
        for (Object value : Arrays.asList(item.getItemCode(), item.getDescription(), item.getOrderDescription(),
                item.getVoltage(), item.getCapacity(), item.getWeight())) {
            String part = Objects.toString(value, "");
            key.append(part.length()).append(':').append(part);
        }
        return UUID.nameUUIDFromBytes(key.toString().getBytes(StandardCharsets.UTF_8)).toString();
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

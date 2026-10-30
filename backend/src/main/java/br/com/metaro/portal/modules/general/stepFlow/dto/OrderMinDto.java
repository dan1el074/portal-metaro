package br.com.metaro.portal.modules.general.stepFlow.dto;

import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderItem;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Getter
public class OrderMinDto {
    private Long id;
    private String number;
    private String quantity;
    private String client;
    private String dueDate;
    private String currentStep;
    private String status;
    private List<Integer> progress;

    public OrderMinDto(Order entity) {
        id = entity.getId();
        number = entity.getDisplayNumber();
        quantity = "-";
        client = entity.getClient();
        dueDate = entity.getDueDate() != null ? entity.getDueDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "-";
        currentStep = entity.getCurrentStep().toString();
        progress = entity.getProgress();
        status = entity.getDisplayStatus();



        Integer producedQuantity = 0;
        Integer allQuantity = 0;

        for (OrderItem item : entity.getItems()) {
            producedQuantity += item.getProducedQuantity();
            allQuantity += item.getQuantity();
        }

        if (!entity.getStatus().equals(OrderStatus.CANCELLED)) {
            quantity = "%d/%d".formatted(producedQuantity, allQuantity);
        }
    }
}

package br.com.metaro.portal.util.erp.dto;

import br.com.metaro.portal.util.erp.ErpSource;
import lombok.Getter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
public class ErpOrderDto {
    private final Integer number;
    private final String client;
    private final String cnpj;
    private final String phone;
    private final String salesperson;
    private final LocalDate startDate;
    private final LocalDate dueDate;
    private final String address;
    private final Double subtotal;
    private final Double discount;
    private final Double total;
    private final List<ErpOrderItemDto> items;
    private List<Long> checklistFlowIds = new ArrayList<>();
    private ErpSource source = ErpSource.PROBUS;

    public ErpOrderDto(
            Integer number,
            String client,
            String cnpj,
            String phone,
            String salesperson,
            LocalDate startDate,
            LocalDate dueDate,
            String address,
            Double subtotal,
            Double discount,
            Double total
    ) {
        this.number = number;
        this.client = client;
        this.cnpj = cnpj;
        this.phone = phone;
        this.salesperson = salesperson;
        this.startDate = startDate;
        this.dueDate = dueDate;
        this.address = address;
        this.subtotal = subtotal;
        this.discount = discount;
        this.total = total;
        this.items = new ArrayList<>();
    }

    public void addItem(ErpOrderItemDto item) {
        items.add(item);
    }

    public void setSource(ErpSource source) {
        this.source = source == null ? ErpSource.PROBUS : source;
    }
}

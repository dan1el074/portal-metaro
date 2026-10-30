package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
public class SerialPlateOrderItemDto {
    private String id;
    private String label;
    private String orderDescription;
    private String description;
    private BigDecimal capacity;
    private String voltage;
    private BigDecimal weight;
}

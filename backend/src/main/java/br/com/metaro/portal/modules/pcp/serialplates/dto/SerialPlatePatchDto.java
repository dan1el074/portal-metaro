package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
public class SerialPlatePatchDto {
    private String of;
    private String order;
    private String orderItem;
    private Boolean readyStock;
    private String client;
    private String description;
    private BigDecimal capacity;
    private String voltage;
    private BigDecimal weight;
    private String provider;
    private String status;
    private String notes;
    private String manufactured;
}

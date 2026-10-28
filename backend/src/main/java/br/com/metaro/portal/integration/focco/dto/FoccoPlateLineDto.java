package br.com.metaro.portal.integration.focco.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FoccoPlateLineDto {
    @JsonProperty("order_number")
    private Long orderNumber;
    private String client;
    private String description;
    private String model;
    private String voltage;
    private String capacity;
    private String weight;
}

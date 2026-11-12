package br.com.metaro.portal.modules.general.stepFlow.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderItemQuantityInputDto {
    @NotNull
    @Min(0)
    private Integer producedQuantity;
}

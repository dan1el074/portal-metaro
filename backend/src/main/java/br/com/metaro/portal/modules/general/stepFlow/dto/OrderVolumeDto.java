package br.com.metaro.portal.modules.general.stepFlow.dto;

import br.com.metaro.portal.modules.general.stepFlow.entities.OrderVolume;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.math.BigDecimal;

@AllArgsConstructor
@Getter
public class OrderVolumeDto {
    private Long id;
    private Integer quantity;
    private BigDecimal length;
    private BigDecimal width;
    private BigDecimal height;
    private BigDecimal weight;

    public OrderVolumeDto(OrderVolume entity) {
        this(entity.getId(), entity.getQuantity(), entity.getLength(), entity.getWidth(), entity.getHeight(), entity.getWeight());
    }
}

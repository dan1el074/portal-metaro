package br.com.metaro.portal.modules.pcp.kanbanExclusion.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonAlias;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class KanbanItemDto {
    @JsonAlias("num_lote")
    private Long lotNumber;

    @JsonAlias("id_ordem")
    private Long orderId;

    @JsonAlias("num_ordem")
    private Long orderNumber;

    @JsonAlias("cod_item")
    private String itemCode;

    @JsonAlias("desc_item")
    private String itemDescription;

    private BigDecimal quantidade;
}

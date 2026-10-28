package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class SerialPlateOrderDto {
    private String client;
    private List<SerialPlateOrderItemDto> items;
}

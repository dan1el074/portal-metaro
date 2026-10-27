package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class SerialPlateRelocationDto {
    private String serial;
    private String order;
    private List<String> stepFlows;
}

package br.com.metaro.portal.modules.pcp.serialplates.dto;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SerialPlateReportRowDto {
    private final String serial;
    private final String description;
    private final String manufactured;
    private final String voltage;
    private final BigDecimal weight;
}

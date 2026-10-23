package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class SerialPlateReportDto {
    private List<SerialPlateDto> records;
    private SerialPlateSettingsDto settings;
}

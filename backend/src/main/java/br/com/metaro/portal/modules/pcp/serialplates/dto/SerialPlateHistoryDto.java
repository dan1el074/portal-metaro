package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.Instant;
import java.util.List;

@Getter
@AllArgsConstructor
public class SerialPlateHistoryDto {
    private Instant at;
    private String author;
    private List<SerialPlateChangeDto> changes;
}

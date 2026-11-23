package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Getter
@Setter
public class SerialPlateDto extends SerialPlatePatchDto {
    private String serial;
    private Long version;
    private Instant updated;
}

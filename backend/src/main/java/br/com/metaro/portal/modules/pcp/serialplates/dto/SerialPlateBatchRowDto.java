package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SerialPlateBatchRowDto {
    private final String serial;
    private final long version;
    private final boolean equipmentData;
}

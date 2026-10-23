package br.com.metaro.portal.modules.pcp.serialplates.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class SerialPlateChangeDto {
    private String field;
    private String before;
    private String after;
}

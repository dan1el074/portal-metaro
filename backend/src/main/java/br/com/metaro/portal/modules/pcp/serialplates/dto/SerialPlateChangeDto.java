package br.com.metaro.portal.modules.pcp.serialplates.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SerialPlateChangeDto {
    private String field;
    private String before;
    private String after;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String beforeLabel;
    @JsonInclude(JsonInclude.Include.NON_NULL)
    private String afterLabel;

    public SerialPlateChangeDto(String field, String before, String after) {
        this.field = field;
        this.before = before;
        this.after = after;
    }
}

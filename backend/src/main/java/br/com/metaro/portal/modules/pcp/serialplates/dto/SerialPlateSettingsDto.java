package br.com.metaro.portal.modules.pcp.serialplates.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SerialPlateSettingsDto {
    @NotNull @Size(max = 120)
    private String crea = "";
    @NotNull @Size(max = 4000)
    private String instructions = "";
    @NotNull @Size(max = 4000)
    private String providers = "";
}

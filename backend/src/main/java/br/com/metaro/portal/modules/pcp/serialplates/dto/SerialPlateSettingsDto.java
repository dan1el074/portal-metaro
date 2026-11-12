package br.com.metaro.portal.modules.pcp.serialplates.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class SerialPlateSettingsDto {
    @NotNull @Size(min = 1, max = 6)
    private List<String> reportColumns = List.of("serial", "description", "manufactured", "voltage", "crea", "weight");
    @NotNull @Size(max = 120)
    private String crea = "";
    @NotNull @Size(max = 4000)
    private String instructions = "";
    @NotNull @Size(max = 4000)
    private String providers = "";
}

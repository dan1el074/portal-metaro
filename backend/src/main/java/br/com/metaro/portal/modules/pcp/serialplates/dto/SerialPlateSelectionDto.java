package br.com.metaro.portal.modules.pcp.serialplates.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class SerialPlateSelectionDto {
    @NotEmpty @Size(max = 10000)
    private List<@NotBlank String> serials;
}

package br.com.metaro.portal.modules.pcp.serialplates.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class SerialPlateMutationDto {
    @NotNull @Valid
    private SerialPlatePatchDto patch;
    @NotEmpty @Size(max = 10000)
    private List<String> fields;
    @NotEmpty @Size(max = 10000)
    private Map<String, Long> versions;
}

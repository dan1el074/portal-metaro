package br.com.metaro.portal.modules.pcp.serialplates.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;

@Getter
@Setter
public class SerialPlateCreateDto {
    @NotNull @DecimalMin("1") @DecimalMax("500") @Digits(integer = 3, fraction = 0)
    private BigDecimal quantity;
    @NotBlank @Size(max = 80)
    private String of;
    @Pattern(regexp = "[0-9]{0,15}")
    private String order = "";
    @Size(max = 64)
    private String orderItem = "";
}

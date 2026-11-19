package br.com.metaro.portal.modules.general.rawMaterials.dto;

import jakarta.validation.constraints.*;
import lombok.*;

import java.math.BigDecimal;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class RawMaterialInputDto {
    @NotBlank(message = "Código é obrigatório")
    @Size(max = 80, message = "Código deve ter no máximo 80 caracteres")
    private String code;
    @NotBlank(message = "Descrição é obrigatória")
    @Size(min = 5, max = 255, message = "Descrição deve ter entre 5 e 255 caracteres")
    private String name;
    private String description;
    @NotNull(message = "Estoque atual é obrigatório")
    @PositiveOrZero(message = "Estoque atual não pode ser negativo")
    private BigDecimal currentStorage;
    @NotNull(message = "Estoque mínimo é obrigatório")
    @PositiveOrZero(message = "Estoque mínimo não pode ser negativo")
    private BigDecimal minStorage;
    @NotNull(message = "Estoque máximo é obrigatório")
    @PositiveOrZero(message = "Estoque máximo não pode ser negativo")
    private BigDecimal maxStorage;
    @PositiveOrZero(message = "Comprimento não pode ser negativo")
    private BigDecimal length;
    @PositiveOrZero(message = "Largura não pode ser negativa")
    private BigDecimal width;
    @PositiveOrZero(message = "Espessura não pode ser negativa")
    private BigDecimal thickness;
    @PositiveOrZero(message = "Altura não pode ser negativa")
    private BigDecimal height;
    @PositiveOrZero(message = "Peso por metro quadrado não pode ser negativo")
    private BigDecimal weightPerSquareMeter;
    @PositiveOrZero(message = "Litros por unidade não pode ser negativo")
    private BigDecimal litersPerUnit;
    @PositiveOrZero(message = "Peso por metro linear não pode ser negativo")
    private BigDecimal weightPerLinearMeter;
    @NotNull(message = "Categoria é obrigatória")
    private Long categoryId;
    @NotNull
    private Boolean active;
    @Size(max = 500, message = "A justificativa deve ter no máximo 500 caracteres")
    private String activationReason;

    public RawMaterialInputDto(String code, String name, String description, BigDecimal currentStorage,
                               BigDecimal minStorage, BigDecimal maxStorage, BigDecimal length, BigDecimal width,
                               BigDecimal thickness, BigDecimal weightPerSquareMeter, Long categoryId,
                               Boolean active) {
        this(code, name, description, currentStorage, minStorage, maxStorage, length, width, thickness,
                BigDecimal.ZERO, weightPerSquareMeter, BigDecimal.ZERO, BigDecimal.ZERO, categoryId, active, null);
    }
}

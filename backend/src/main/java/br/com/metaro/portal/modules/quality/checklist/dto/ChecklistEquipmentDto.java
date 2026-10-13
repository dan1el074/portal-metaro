package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Getter
@Setter
@NoArgsConstructor
public class ChecklistEquipmentDto {
    private Long id;
    @NotBlank
    private String name;
    @NotBlank
    private String abbreviation;
}

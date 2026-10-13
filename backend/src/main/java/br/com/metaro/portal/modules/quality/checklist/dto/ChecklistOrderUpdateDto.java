package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistOrderUpdateDto {
    @NotBlank
    private String order;

    @NotBlank
    private String item;
}

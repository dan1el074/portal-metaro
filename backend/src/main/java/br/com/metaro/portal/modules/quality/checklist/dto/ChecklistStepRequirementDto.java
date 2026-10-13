package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Getter
@Setter
@NoArgsConstructor
public class ChecklistStepRequirementDto {
    @NotNull
    private String stepType;
    @NotNull
    private Long categoryId;
}

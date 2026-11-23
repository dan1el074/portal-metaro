package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistVideoCreateDto {
    @jakarta.validation.constraints.PositiveOrZero
    @jakarta.validation.constraints.NotNull
    private Long problemId;
    @NotBlank
    private String name;
}

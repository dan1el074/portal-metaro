package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChecklistAccessChangeDto {
    @NotNull
    private Long categoryId;
    @NotNull
    private Long userId;
    @NotNull
    private Boolean allowed;
}

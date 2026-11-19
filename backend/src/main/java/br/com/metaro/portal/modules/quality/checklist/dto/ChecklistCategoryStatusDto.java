package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ChecklistCategoryStatusDto {
    @NotNull
    private Boolean active;
    private String reason;
}

package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistReasonDto {
    @NotBlank
    private String reason;
}

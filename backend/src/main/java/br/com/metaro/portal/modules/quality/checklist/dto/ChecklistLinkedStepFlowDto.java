package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistLinkedStepFlowDto {
    private Long id;
    private String order;
    private String status;
    private String currentStep;
}

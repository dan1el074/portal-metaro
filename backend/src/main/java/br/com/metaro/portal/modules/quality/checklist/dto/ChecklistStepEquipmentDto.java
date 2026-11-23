package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Getter
@Setter
@NoArgsConstructor
public class ChecklistStepEquipmentDto {
    private Long flowId;
    private Long recordId;
    private String serial;
    private String item;
    private boolean selected;
}

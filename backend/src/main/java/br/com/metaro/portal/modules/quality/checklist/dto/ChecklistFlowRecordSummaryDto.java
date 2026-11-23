package br.com.metaro.portal.modules.quality.checklist.dto;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ChecklistFlowRecordSummaryDto {
    private final Long templateId;
    private final Long recordId;
    private final ChecklistStatus status;
    private final Long responsibleId;
}

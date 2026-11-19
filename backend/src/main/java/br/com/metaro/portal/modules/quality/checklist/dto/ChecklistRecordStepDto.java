package br.com.metaro.portal.modules.quality.checklist.dto;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ChecklistRecordStepDto {
    private final Long templateId;
    private final String label;
    private final String title;
    private final Long recordId;
    private final ChecklistStatus status;
    private final boolean skipped;
}

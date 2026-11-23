package br.com.metaro.portal.modules.quality.checklist.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ChecklistRecordContextDto {
    private final ChecklistRecordDto record;
    private final ChecklistFlowDto flow;
    private final boolean editable;
    private final boolean clientNokHistory;
    private final boolean blocked;
    private final Long previousId;
    private final Long nextId;
    private final List<ChecklistRecordStepDto> steps;
}

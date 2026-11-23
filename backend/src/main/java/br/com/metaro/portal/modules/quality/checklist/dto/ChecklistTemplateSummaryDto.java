package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ChecklistTemplateSummaryDto {
    private final Long id;
    private final String name;
    private final Long categoryId;
    private final Long equipmentId;
    private final String equipment;
    private final Long predecessorId;
    private final int version;
    private final boolean used;
}

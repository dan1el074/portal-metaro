package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistIntegration;

@Getter
@AllArgsConstructor
public class ChecklistCategoryHistoryDto {
    private final Long id;
    private final String name;
    private final ChecklistIntegration integration;
    private final boolean clientNokHistory;
}

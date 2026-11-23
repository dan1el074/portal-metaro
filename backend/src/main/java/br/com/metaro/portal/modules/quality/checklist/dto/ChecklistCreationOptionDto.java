package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistIntegration;

@Getter
@AllArgsConstructor
public class ChecklistCreationOptionDto {
    private final Long id;
    private final String name;
    private final Long categoryId;
    private final String categoryName;
    private final ChecklistIntegration integration;
    private final boolean erp;
    private final boolean serial;
    private final boolean standalone;
    private final boolean hasPredecessor;
}

package br.com.metaro.portal.modules.quality.checklist.dto;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistIntegration;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class ChecklistCategoryModelOptionDto {
    private final Long id;
    private final String name;
    private final ChecklistIntegration integration;
    private final boolean erp;
    private final String re;
    private final String ref;
    private final boolean media;
    private final List<String> fieldIds;
}

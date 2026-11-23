package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistSnapshotDto {
    private ChecklistTemplateDto template;
    private ChecklistCategoryDto category;
    private String equipment;
}

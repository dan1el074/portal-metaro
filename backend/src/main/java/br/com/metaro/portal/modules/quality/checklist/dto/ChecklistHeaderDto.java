package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class ChecklistHeaderDto {
    private final List<ChecklistCategoryTabDto> categories;
    private final List<ChecklistHeaderCountDto> headerCount;
}

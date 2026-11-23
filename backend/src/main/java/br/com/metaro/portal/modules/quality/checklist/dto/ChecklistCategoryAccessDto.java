package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class ChecklistCategoryAccessDto {
    private final Long id;
    private final String name;
    private final List<Long> operators;
}

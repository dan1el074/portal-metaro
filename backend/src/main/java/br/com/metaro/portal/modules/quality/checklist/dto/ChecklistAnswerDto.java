package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistAnswerDto {
    private String value;
    private String description;
    private Map<String, String> fields = new HashMap<>();
    private List<ChecklistProblemDto> problems = new ArrayList<>();
}

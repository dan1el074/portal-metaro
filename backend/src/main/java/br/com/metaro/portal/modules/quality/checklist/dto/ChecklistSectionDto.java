package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistSectionDto {
    private String id;
    private String name;
    private List<String> options = new ArrayList<>();
    private List<ChecklistQuestionDto> questions = new ArrayList<>();
}

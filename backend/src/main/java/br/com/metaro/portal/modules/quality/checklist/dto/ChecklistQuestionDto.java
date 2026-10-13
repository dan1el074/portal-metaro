package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistQuestionDto {
    private String id;
    private String label;
    private List<ChecklistFieldDto> fields = new ArrayList<>();
}

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
public class ChecklistProblemDto {
    private String id;
    private String item;
    private String code;
    private String defect;
    private String description;
    private String department;
    private List<ChecklistEvidenceDto> media = new ArrayList<>();
    private Map<String, String> customFields = new HashMap<>();
    private boolean treated;
    private String commentId;
}

package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistFieldDto {
    private String id;
    private String label;
    private String type;
    private List<String> options = new ArrayList<>();
    private String defaultValue;
}

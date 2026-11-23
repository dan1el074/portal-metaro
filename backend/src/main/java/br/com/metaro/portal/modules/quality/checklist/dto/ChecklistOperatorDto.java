package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistOperatorDto {
    private Long id;
    private String name;
    private boolean activated;
}

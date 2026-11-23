package br.com.metaro.portal.modules.pcp.kanbanExclusion.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class KanbanDeleteResultDto {
    private boolean deleted;
    private String message;
}

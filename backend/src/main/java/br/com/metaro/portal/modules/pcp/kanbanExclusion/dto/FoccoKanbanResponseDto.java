package br.com.metaro.portal.modules.pcp.kanbanExclusion.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FoccoKanbanResponseDto {
    private List<KanbanItemDto> value;
    private boolean failed;
    private boolean allFailed;
    private String baseErrorMessage;
    private String errorMessage;
}

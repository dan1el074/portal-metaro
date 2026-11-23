package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.Instant;

@Getter
@AllArgsConstructor
public class ChecklistPredecessorDto {
    private final Long id;
    private final String serial;
    private final String title;
    private final Instant finished;
}

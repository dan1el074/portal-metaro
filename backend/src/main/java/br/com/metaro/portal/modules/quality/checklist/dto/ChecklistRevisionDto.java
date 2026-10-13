package br.com.metaro.portal.modules.quality.checklist.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistRevisionDto {
    private Long id;
    private Instant at;
    private String actor;
    private String reason;
    private JsonNode record;
}

package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistAuditDto {
    private Long id;
    private Instant at;
    private String actor;
    private String action;
    private String details;
}

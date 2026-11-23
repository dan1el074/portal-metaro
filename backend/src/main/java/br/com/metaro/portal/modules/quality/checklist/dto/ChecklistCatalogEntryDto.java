package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistCatalogEntryDto {
    private Long id;
    @NotNull
    private String type;
    @NotBlank
    private String name;
    private boolean active = true;
    private Long createdBy;
    private Instant createdAt;
}

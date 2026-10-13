package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistTemplateDto {
    private Long id;
    @NotNull
    private Long categoryId;
    @NotBlank
    private String name;
    private Long equipmentId;
    @NotNull
    private String title;
    private List<ChecklistSectionDto> sections = new ArrayList<>();
    private boolean signature;
    private Long predecessorId;
    private boolean automatic;
    private int version;
    private int displayOrder;
}

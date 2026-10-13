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
public class ChecklistCategoryDto {
    private Long id;
    @NotBlank
    private String name;
    @NotNull
    private String integration;
    private boolean active = true;
    private String reason;
    private int displayOrder;
    private boolean logo = true;
    private String re;
    private String ref;
    private String documentTitle;
    private boolean clientNokHistory = true;
    private boolean dates;
    private boolean departments = true;
    private boolean serial = true;
    private boolean erp = true;
    private List<ChecklistFieldDto> fields = new ArrayList<>();
    private List<Long> operators = new ArrayList<>();
}

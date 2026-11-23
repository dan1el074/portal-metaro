package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistStepBindingDto {
    @NotNull
    private List<Long> flowIds = new ArrayList<>();
}

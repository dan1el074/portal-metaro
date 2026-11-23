package br.com.metaro.portal.modules.general.rawMaterials.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserCategoriesDto {
    @NotNull
    private Long id;
    @NotNull
    private List<Long> categoryIds;
}

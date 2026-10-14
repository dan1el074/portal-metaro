package br.com.metaro.portal.modules.general.stepFlow.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class OrderVolumeInputDto {
    private Long id;
    private Integer quantity;
    private String length;
    private String width;
    private String height;
    private String weight;
}

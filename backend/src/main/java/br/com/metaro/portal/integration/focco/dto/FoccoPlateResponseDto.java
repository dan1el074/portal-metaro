package br.com.metaro.portal.integration.focco.dto;

import lombok.Getter;
import lombok.Setter;
import java.util.List;

@Getter
@Setter
public class FoccoPlateResponseDto {
    private List<FoccoPlateLineDto> value;
    private boolean succeeded;
    private boolean failed;
    private boolean allFailed;
    private String errorMessage;
    private String baseErrorMessage;
}

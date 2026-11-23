package br.com.metaro.portal.util.email.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CssDeclarationDto {
    private String value;
    private boolean important;
    private int specificity;
    private int sourceOrder;
}

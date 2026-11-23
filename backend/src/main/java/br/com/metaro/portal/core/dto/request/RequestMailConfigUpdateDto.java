package br.com.metaro.portal.core.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class RequestMailConfigUpdateDto {
    @NotBlank(message = "Informe o e-mail destinatário das solicitações de acesso.")
    @Email(message = "Informe um e-mail destinatário válido para as solicitações de acesso.")
    private String to;
}

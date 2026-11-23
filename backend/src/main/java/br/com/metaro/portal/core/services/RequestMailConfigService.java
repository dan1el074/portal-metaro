package br.com.metaro.portal.core.services;

import br.com.metaro.portal.core.dto.request.RequestMailConfigDto;
import br.com.metaro.portal.core.dto.request.RequestMailConfigUpdateDto;
import br.com.metaro.portal.core.entities.Param;
import br.com.metaro.portal.core.repositories.ParamRepository;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class RequestMailConfigService {
    static final String RECIPIENT_PARAM = "app.request.mail.to";

    private final ParamRepository paramRepository;

    @Transactional(readOnly = true)
    public RequestMailConfigDto getConfig() {
        return new RequestMailConfigDto(findRecipient());
    }

    @Transactional(readOnly = true)
    public String getRecipient() {
        String recipient = findRecipient();
        if (!StringUtils.hasText(recipient)) {
            throw new UnprocessableEntityException(
                    "Configure o e-mail destinatário das solicitações de acesso nos parâmetros do sistema."
            );
        }
        return recipient;
    }

    private String findRecipient() {
        return paramRepository.findByName(RECIPIENT_PARAM)
                .map(Param::getContent)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .orElse("");
    }

    @Transactional
    public RequestMailConfigDto updateConfig(RequestMailConfigUpdateDto dto) {
        String recipient = dto.getTo().trim();
        Param param = paramRepository.findByName(RECIPIENT_PARAM)
                .orElseGet(() -> new Param(null, RECIPIENT_PARAM, null));
        param.setContent(recipient);
        paramRepository.save(param);
        return new RequestMailConfigDto(recipient);
    }
}

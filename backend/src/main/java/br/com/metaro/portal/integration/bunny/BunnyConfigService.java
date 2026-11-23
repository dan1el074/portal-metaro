package br.com.metaro.portal.integration.bunny;

import br.com.metaro.portal.core.entities.Param;
import br.com.metaro.portal.core.repositories.ParamRepository;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.integration.bunny.dto.BunnyConfigDto;
import br.com.metaro.portal.integration.bunny.dto.BunnyConfigUpdateDto;
import lombok.RequiredArgsConstructor;
import br.com.metaro.portal.integration.bunny.dto.BunnyCredentialsDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class BunnyConfigService {
    static final String LIBRARY_ID_PARAM = "bunny.integration.library-id";
    static final String API_KEY_PARAM = "bunny.integration.api-key";

    private final ParamRepository paramRepository;

    @Transactional(readOnly = true)
    public BunnyConfigDto getConfig() {
        return new BunnyConfigDto(
                findValue(LIBRARY_ID_PARAM),
                StringUtils.hasText(findValue(API_KEY_PARAM))
        );
    }

    @Transactional
    public BunnyConfigDto updateConfig(BunnyConfigUpdateDto dto) {
        String libraryId = dto.getLibraryId().trim();
        String currentApiKey = findValue(API_KEY_PARAM);
        String apiKey = StringUtils.hasText(dto.getApiKey()) ? dto.getApiKey().trim() : currentApiKey;

        if (!StringUtils.hasText(apiKey)) {
            throw new UnprocessableEntityException("Informe a API key do Bunny Stream.");
        }

        saveValue(LIBRARY_ID_PARAM, libraryId);
        saveValue(API_KEY_PARAM, apiKey);
        return new BunnyConfigDto(libraryId, true);
    }

    @Transactional(readOnly = true)
    public BunnyCredentialsDto getCredentials() {
        String libraryId = findValue(LIBRARY_ID_PARAM);
        String apiKey = findValue(API_KEY_PARAM);
        if (!StringUtils.hasText(libraryId) || !StringUtils.hasText(apiKey)) {
            throw new UnprocessableEntityException("A integração com o Bunny Stream não está configurada!");
        }
        return new BunnyCredentialsDto(libraryId, apiKey);
    }

    private String findValue(String name) {
        return paramRepository.findByName(name).map(Param::getContent).orElse("");
    }

    private void saveValue(String name, String content) {
        Param param = paramRepository.findByName(name).orElseGet(() -> new Param(null, name, null));
        param.setContent(content);
        paramRepository.save(param);
    }

}

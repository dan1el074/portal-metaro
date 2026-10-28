package br.com.metaro.portal.integration.focco;

import br.com.metaro.portal.integration.focco.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;
import java.net.URI;
import java.util.List;

@Component
public class FoccoPlateClient {
    private final FoccoConfigService configService;
    private final String endpoint;
    private final RestTemplate restTemplate;

    public FoccoPlateClient(FoccoConfigService configService,
            @Value("${focco.module.serial-plates:/FoccoIntegrador/api/v1/Exportacao/portal_plaquetas}") String endpoint) {
        this.configService = configService;
        this.endpoint = endpoint;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(30_000);
        this.restTemplate = new RestTemplate(factory);
    }

    public List<FoccoPlateLineDto> findPlateOrder(long number) {
        FoccoCredentialsDto credentials = configService.getCredentials();
        URI uri = UriComponentsBuilder.fromUriString(credentials.getBaseUrl().replaceAll("/+$", "") + "/" + endpoint.replaceAll("^/+", ""))
                .queryParam("Chave", credentials.getKey()).queryParam("order_number", number).build().encode().toUri();
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(credentials.getToken());
        FoccoPlateResponseDto body;
        try {
            body = restTemplate.exchange(uri, HttpMethod.GET, new HttpEntity<>(headers), FoccoPlateResponseDto.class).getBody();
        } catch (RestClientException exception) {
            // Do not propagate an upstream URL containing credentials to API errors.
            throw new FoccoIntegrationException("Não foi possível consultar as plaquetas no FoccoERP.");
        }
        if (body == null || body.isFailed() || body.isAllFailed() || !body.isSucceeded()) {
            throw new FoccoIntegrationException("O FoccoERP não concluiu a consulta de plaquetas.");
        }
        return body.getValue() == null ? List.of() : body.getValue();
    }
}

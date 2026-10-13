package br.com.metaro.portal.modules.pcp.kanbanExclusion;

import br.com.metaro.portal.integration.focco.FoccoConfigService;
import br.com.metaro.portal.integration.focco.FoccoIntegrationException;
import br.com.metaro.portal.integration.focco.dto.FoccoCredentialsDto;
import br.com.metaro.portal.modules.pcp.kanbanExclusion.dto.FoccoKanbanDeleteResponseDto;
import br.com.metaro.portal.modules.pcp.kanbanExclusion.dto.FoccoKanbanResponseDto;
import br.com.metaro.portal.modules.pcp.kanbanExclusion.dto.KanbanDeleteResultDto;
import br.com.metaro.portal.modules.pcp.kanbanExclusion.dto.KanbanItemDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;

@Component
public class KanbanExclusionClient {
    private final FoccoConfigService configService;
    private final ObjectMapper objectMapper;
    private final String lotEndpoint;
    private final String manufacturingOrdersEndpoint;
    private final RestTemplate restTemplate;

    public KanbanExclusionClient(
            FoccoConfigService configService,
            ObjectMapper objectMapper,
            @Value("${focco.module.kanban-lot}") String lotEndpoint,
            @Value("${focco.module.manufacturing-orders}") String manufacturingOrdersEndpoint
    ) {
        this.configService = configService;
        this.objectMapper = objectMapper;
        this.lotEndpoint = lotEndpoint;
        this.manufacturingOrdersEndpoint = manufacturingOrdersEndpoint;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(10_000);
        requestFactory.setReadTimeout(30_000);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public List<KanbanItemDto> findByLotNumber(long lotNumber) {
        FoccoCredentialsDto credentials = configService.getCredentials();
        URI uri = UriComponentsBuilder.fromUriString(buildUrl(credentials.getBaseUrl(), lotEndpoint))
                .queryParam("chave", credentials.getKey())
                .queryParam("num_lote", lotNumber)
                .queryParam("orderAsc", "cod_item")
                .build()
                .encode()
                .toUri();

        try {
            ResponseEntity<FoccoKanbanResponseDto> response = restTemplate.exchange(
                    uri,
                    HttpMethod.GET,
                    authorizedEntity(credentials),
                    FoccoKanbanResponseDto.class
            );
            return validateResponse(response.getBody());
        } catch (HttpStatusCodeException exception) {
            throw integrationFailure("consultar o lote no FoccoERP", exception);
        } catch (RestClientException exception) {
            throw new FoccoIntegrationException("Não foi possível consultar o lote no FoccoERP.", exception);
        }
    }

    public KanbanDeleteResultDto deleteManufacturingOrder(long orderId) {
        FoccoCredentialsDto credentials = configService.getCredentials();
        URI uri = UriComponentsBuilder.fromUriString(buildUrl(credentials.getBaseUrl(), manufacturingOrdersEndpoint))
                .pathSegment(Long.toString(orderId))
                .build()
                .encode()
                .toUri();

        try {
            ResponseEntity<FoccoKanbanDeleteResponseDto> response = restTemplate.exchange(
                    uri,
                    HttpMethod.DELETE,
                    authorizedEntity(credentials),
                    FoccoKanbanDeleteResponseDto.class
            );
            return validateDeleteResponse(response.getBody());
        } catch (HttpStatusCodeException exception) {
            throw integrationFailure("excluir a ordem de fabricação " + orderId, exception);
        } catch (RestClientException exception) {
            throw new FoccoIntegrationException(
                    "Não foi possível excluir a ordem de fabricação " + orderId + " no FoccoERP.",
                    exception
            );
        }
    }

    private HttpEntity<Void> authorizedEntity(FoccoCredentialsDto credentials) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(credentials.getToken());
        return new HttpEntity<>(headers);
    }

    private List<KanbanItemDto> validateResponse(FoccoKanbanResponseDto response) {
        if (response == null) {
            throw new FoccoIntegrationException("O FoccoERP retornou uma resposta vazia.");
        }
        if (response.isFailed() || response.isAllFailed()) {
            String detail = StringUtils.hasText(response.getErrorMessage())
                    ? response.getErrorMessage()
                    : response.getBaseErrorMessage();
            String message = StringUtils.hasText(detail)
                    ? "O FoccoERP não concluiu a consulta: " + detail
                    : "O FoccoERP não concluiu a consulta do lote.";
            throw new FoccoIntegrationException(message);
        }
        return response.getValue() == null ? List.of() : response.getValue();
    }

    private KanbanDeleteResultDto validateDeleteResponse(FoccoKanbanDeleteResponseDto response) {
        if (response == null) {
            throw new FoccoIntegrationException("O FoccoERP retornou uma resposta vazia ao excluir a ordem.");
        }

        String detail = StringUtils.hasText(response.getValue())
                ? response.getValue()
                : firstNonBlank(response.getErrorMessage(), response.getBaseErrorMessage());

        if (!StringUtils.hasText(detail)) {
            throw new FoccoIntegrationException("O FoccoERP não informou o resultado da exclusão da ordem.");
        }

        return new KanbanDeleteResultDto(isSuccessfulDeletion(detail), detail);
    }

    private boolean isSuccessfulDeletion(String message) {
        String normalizedMessage = Normalizer.normalize(message, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
        return normalizedMessage.contains("excluid") && normalizedMessage.contains("com sucesso");
    }

    private String firstNonBlank(String first, String second) {
        if (StringUtils.hasText(first)) {
            return first;
        }
        return StringUtils.hasText(second) ? second : "";
    }

    private FoccoIntegrationException integrationFailure(String action, HttpStatusCodeException exception) {
        String responseBody = exception.getResponseBodyAsString();
        String value = extractJsonText(responseBody, "value");
        if (StringUtils.hasText(value)) {
            return new FoccoIntegrationException(value, exception);
        }

        String detail = extractProblemDetail(responseBody);
        String status = exception.getStatusCode().value() + " " + exception.getStatusText();
        String message = "O FoccoERP recusou a operação ao " + action + " (" + status + ").";
        if (StringUtils.hasText(detail)) {
            message += " " + detail;
        }
        return new FoccoIntegrationException(message, exception);
    }

    private String extractProblemDetail(String responseBody) {
        String detail = extractJsonText(responseBody, "detail");
        if (StringUtils.hasText(detail)) {
            return detail;
        }
        return extractJsonText(responseBody, "title");
    }

    private String extractJsonText(String responseBody, String field) {
        if (!StringUtils.hasText(responseBody)) {
            return "";
        }
        try {
            JsonNode body = objectMapper.readTree(responseBody);
            if (body.hasNonNull(field) && StringUtils.hasText(body.get(field).asText())) {
                return body.get(field).asText();
            }
        } catch (Exception ignored) {
            // O corpo de erro do ERP nem sempre é JSON; o status HTTP ainda é preservado na mensagem.
        }
        return "";
    }

    private String buildUrl(String baseUrl, String endpoint) {
        String normalizedBaseUrl = baseUrl.replaceAll("/+$", "");
        String normalizedEndpoint = endpoint.replaceAll("^/+", "");
        return normalizedBaseUrl + "/" + normalizedEndpoint;
    }
}

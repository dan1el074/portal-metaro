package br.com.metaro.portal.integration.bunny;

import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.integration.bunny.dto.TusCredentialsDto;
import br.com.metaro.portal.integration.bunny.dto.BunnyCredentialsDto;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@Component
public class BunnyStreamClient {
    private static final String API_BASE_URL = "https://video.bunnycdn.com/library";
    private static final String TUS_UPLOAD_ENDPOINT = "https://video.bunnycdn.com/tusupload";

    private final BunnyStreamProperties properties;
    private final BunnyConfigService configService;
    private final RestTemplate restTemplate;

    public BunnyStreamClient(BunnyStreamProperties properties, BunnyConfigService configService) {
        this.properties = properties;
        this.configService = configService;
        this.restTemplate = new RestTemplate();
    }

    public String createVideo(String title) {
        BunnyCredentialsDto config = configService.getCredentials();
        HttpHeaders headers = createAuthenticationHeaders(config);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<Map<String, String>> request = new HttpEntity<>(Map.of("title", title), headers);
        String url = API_BASE_URL + "/" + config.getLibraryId() + "/videos";
        ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);

        if (response.getBody() == null || response.getBody().get("guid") == null) {
            throw new UnprocessableEntityException("Não foi possível criar o vídeo no Bunny Stream!");
        }

        return response.getBody().get("guid").toString();
    }

    public void deleteVideo(String providerVideoId) {
        BunnyCredentialsDto config = configService.getCredentials();
        HttpEntity<Void> request = new HttpEntity<>(createAuthenticationHeaders(config));
        String url = API_BASE_URL + "/" + config.getLibraryId() + "/videos/" + providerVideoId;

        try {
            restTemplate.exchange(url, HttpMethod.DELETE, request, Void.class);
        } catch (HttpClientErrorException.NotFound ignored) {
            // O registro remoto já foi removido;
        }
    }

    public TusCredentialsDto generateTusCredentials(String providerVideoId) {
        BunnyCredentialsDto config = configService.getCredentials();
        long expiration = Instant.now().plus(1, ChronoUnit.HOURS).getEpochSecond();
        String content = config.getLibraryId() + config.getApiKey() + expiration + providerVideoId;

        return new TusCredentialsDto(sha256Hex(content), expiration);
    }

    public String buildPlaybackUrl(String providerVideoId) {
        BunnyCredentialsDto config = configService.getCredentials();
        return removeTrailingSlash(properties.getEmbedBaseUrl())
                + "/" + config.getLibraryId()
                + "/" + providerVideoId;
    }

    public String getPreviewUrl(String providerVideoId, boolean animated) {
        BunnyCredentialsDto config = configService.getCredentials();
        HttpEntity<Void> request = new HttpEntity<>(createAuthenticationHeaders(config));
        String url = API_BASE_URL + "/" + config.getLibraryId() + "/videos/" + providerVideoId + "/play";
        ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, request, Map.class);
        Map body = response.getBody();
        String key = animated ? "previewUrl" : "thumbnailUrl";

        if (body == null || body.get(key) == null) {
            throw new UnprocessableEntityException("A prévia do vídeo ainda não está disponível!");
        }

        return body.get(key).toString();
    }

    private HttpHeaders createAuthenticationHeaders(BunnyCredentialsDto config) {
        HttpHeaders headers = new HttpHeaders();
        headers.set("AccessKey", config.getApiKey());
        return headers;
    }

    private String removeTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 não está disponível", exception);
        }
    }

    public String getLibraryId() {
        return configService.getCredentials().getLibraryId();
    }

    public String getTusUploadEndpoint() {
        return TUS_UPLOAD_ENDPOINT;
    }
}

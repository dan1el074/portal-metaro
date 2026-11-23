package br.com.metaro.portal.modules.quality.checklist.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** Renders the frozen template, using the same tokens as the checklist document. */
public final class ChecklistRecordTitle {
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern TOKENS = Pattern.compile("%(?:data|serie|pedido|cliente|item|vendedor|\\d+\\.\\d+)|\\{([^}]+)}");
    private ChecklistRecordTitle() {}

    public static String render(String plan, long templateId, String answers, Instant created, Long id,
                                String serial, String order, String client, String item, String seller) {
        try {
            JsonNode template = null;
            for (JsonNode step : JSON.readTree(plan)) {
                if (step.path("template").path("id").asLong() == templateId) template = step.path("template");
            }
            if (template == null) throw new IllegalStateException("Modelo ausente no fluxo do checklist.");
            JsonNode values = JSON.readTree(answers == null ? "{}" : answers);
            Map<String, String> tokens = new HashMap<>();
            tokens.put("%data", created == null ? "" : DateTimeFormatter.ofPattern("dd/MM/yyyy, HH:mm:ss")
                    .withZone(ZoneId.of("America/Sao_Paulo")).format(created));
            tokens.put("%serie", serial); tokens.put("%pedido", order); tokens.put("%cliente", client);
            tokens.put("%item", item); tokens.put("%vendedor", seller);
            tokens.put("{data}", tokens.get("%data"));
            int sectionIndex = 0;
            for (JsonNode section : template.path("sections")) {
                int questionIndex = 0;
                for (JsonNode question : section.path("questions")) {
                    JsonNode field = question.path("fields").path(0);
                    String value = values.path(question.path("id").asText()).path("fields").path(field.path("id").asText()).asText("");
                    tokens.put("%" + (sectionIndex + 1) + "." + (++questionIndex), value);
                    tokens.put("{" + question.path("id").asText() + "}", value);
                }
                sectionIndex++;
            }
            String title = TOKENS.matcher(template.path("title").asText("")).replaceAll(match -> {
                String value = tokens.get(match.group());
                return java.util.regex.Matcher.quoteReplacement(value == null || value.isEmpty() ? "." : value);
            }).trim();
            return title.isEmpty() ? template.path("name").asText() + " · " + (id == null ? "" : id) : title;
        } catch (java.io.IOException exception) {
            throw new IllegalStateException("Não foi possível gerar o título do checklist.", exception);
        }
    }
}

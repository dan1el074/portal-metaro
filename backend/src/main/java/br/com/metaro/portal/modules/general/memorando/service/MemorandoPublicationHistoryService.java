package br.com.metaro.portal.modules.general.memorando.service;

import br.com.metaro.portal.modules.general.memorando.dto.MemorandoPublicationSnapshotDto;
import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class MemorandoPublicationHistoryService {
    private final ObjectMapper json;

    public void capture(Memorando entity) {
        try {
            entity.setPublishedSnapshotJson(json.writeValueAsString(snapshot(entity)));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Não foi possível registrar a versão publicada do memorando.", exception);
        }
    }

    public String publicationMessage(Memorando entity, boolean republishing) {
        String heading = "%s o documento nº %d/%d".formatted(republishing ? "Republicou" : "Publicou",
                entity.getNumber(), entity.getCreateAt().atZone(ZoneId.systemDefault()).getYear());
        if (!republishing || entity.getPublishedSnapshotJson() == null) return heading;
        try {
            MemorandoPublicationSnapshotDto previous = json.readValue(entity.getPublishedSnapshotJson(), MemorandoPublicationSnapshotDto.class);
            MemorandoPublicationSnapshotDto current = snapshot(entity);
            List<String> lines = new ArrayList<>();
            lines.add(heading);
            difference(lines, "Título", previous.getTitle(), current.getTitle());
            if (!Objects.equals(previous.getDescription(), current.getDescription())) lines.add("Descrição alterada.");
            difference(lines, "Motivo", previous.getReason(), current.getReason());
            difference(lines, "Pedido", previous.getRequest(), current.getRequest());
            difference(lines, "ERP de origem", previous.getErpSource(), current.getErpSource());
            difference(lines, "Cliente", previous.getClient(), current.getClient());
            if (!Objects.equals(previous.getItems(), current.getItems())) {
                difference(lines, "Itens", String.join(", ", previous.getItems()), String.join(", ", current.getItems()));
            }
            if (!previous.getDepartments().keySet().equals(current.getDepartments().keySet())) {
                difference(lines, "Departamentos", String.join(", ", previous.getDepartments().values()),
                        String.join(", ", current.getDepartments().values()));
            }
            return String.join("\n", lines);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Não foi possível comparar as versões do memorando.", exception);
        }
    }

    private MemorandoPublicationSnapshotDto snapshot(Memorando entity) {
        MemorandoPublicationSnapshotDto snapshot = new MemorandoPublicationSnapshotDto();
        snapshot.setRequest(entity.getRequest()); snapshot.setErpSource(entity.getErpSource());
        snapshot.setClient(entity.getClient()); snapshot.setItems(new ArrayList<>(entity.getItems()));
        snapshot.setTitle(entity.getTitle()); snapshot.setDescription(entity.getDescription()); snapshot.setReason(entity.getReason());
        snapshot.setDepartments(new LinkedHashMap<>());
        entity.getFromDepartments().forEach(department -> snapshot.getDepartments().put(department.getId(), department.getName()));
        return snapshot;
    }

    private void difference(List<String> lines, String label, Object previous, Object current) {
        if (!Objects.equals(previous, current)) lines.add(label + ": " + display(previous) + " -> " + display(current));
    }

    private String display(Object value) {
        if (value == null || value.toString().isBlank()) return "-";
        return value.toString().replaceAll("\\s+", " ").trim();
    }
}

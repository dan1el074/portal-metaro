package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistFlowDto {
    private Long id;
    private String serial;
    private String order;
    private String clientId;
    private String client;
    private String item;
    private String seller;
    private List<ChecklistSnapshotDto> plan = new ArrayList<>();
    private Map<String, String> skipped = new HashMap<>();
    private boolean cancelled;
    private String cancellationReason;
    private Instant createdAt;
    private Instant updatedAt;
}

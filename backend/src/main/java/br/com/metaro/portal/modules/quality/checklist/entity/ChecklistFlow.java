package br.com.metaro.portal.modules.quality.checklist.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_flow")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistFlow {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String serialNumber;
    private String normalizedSerial;
    private String orderNumber;
    private String clientId;
    private String clientName;
    private String commercialItem;
    private String salesperson;
    @Column(name = "plan_json", columnDefinition = "TEXT")
    private String planJson;
    @Column(name = "skipped_json", columnDefinition = "TEXT")
    private String skippedJson;
    private boolean cancelled;
    private String cancellationReason;
    private Instant createdAt;
    private Instant updatedAt;
}

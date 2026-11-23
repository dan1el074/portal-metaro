package br.com.metaro.portal.modules.general.stepFlow.entities;

import br.com.metaro.portal.util.erp.ErpSource;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Entity
@Table(name = "tb_stepflow_order")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Integer number;
    @Column(nullable = false)
    private Integer occurrence = 1;
    @Enumerated(EnumType.STRING)
    private StepType currentStep; // atualizar sempre que mexer no OrderStep
    @Enumerated(EnumType.STRING)
    private OrderStatus status; // LATE -> apenas quando a dueDate passar (apenas DTO)
    private Double shipment;
    private String carrier;
    @Column(nullable = false)
    private boolean checklistIntegration = true;

    // ERP
    private String client;
    private String cnpj;
    private String phone;
    private String seller;
    private LocalDate startDate;
    private LocalDate dueDate;
    private String address;
    private Double subtotal;
    private Double discount;
    private Double total;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ErpSource erpSource = ErpSource.PROBUS;

    // auditoria
    @Column(columnDefinition = "TIMESTAMP WITHOUT TIME ZONE")
    private Instant createdAt;
    @Column(columnDefinition = "TIMESTAMP WITHOUT TIME ZONE")
    private Instant updatedAt;

    // relacionamento
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderItem> items;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id ASC")
    private List<OrderStep> steps;
    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<OrderVolume> volumes;

    // métodos
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    public void addStep(OrderStep step) {
        steps.add(step);
        step.setOrder(this);
    }

    public void addVolume(OrderVolume volume) {
        volumes.add(volume);
        volume.setOrder(this);
    }

    @Transient
    public String getDisplayStatus() {
        if (status == OrderStatus.IN_PROGRESS) {
            if (checklistIntegration && steps != null && steps.stream()
                    .anyMatch(step -> step.getStep() == currentStep && step.isChecklistPending())) return "Pendente";
            if (dueDate != null && dueDate.isBefore(LocalDate.now())) return OrderStatus.LATE.toString();
        }
        return status.toString();
    }

    @Transient
    public String getDisplayNumber() {
        return occurrence != null && occurrence > 1 ? "%d-%d".formatted(number, occurrence) : number.toString();
    }

    @Transient
    public List<Integer> getProgress() {
        Map<StepType, StepStatus> stepStatusMap = steps.stream()
                .collect(Collectors.toMap(OrderStep::getStep, OrderStep::getStatus));

        return Arrays.stream(StepType.values()).map(stepType -> {
            StepStatus stepStatus = stepStatusMap.getOrDefault(stepType, StepStatus.WAITING);
            return switch (stepStatus) {
                case WAITING -> 0;
                case ACTIVE -> 1;
                case DONE -> 2;
            };
        }).toList();
    }

    @PrePersist
    public void prePersist() {
        createdAt = Instant.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }
}

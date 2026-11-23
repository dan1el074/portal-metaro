package br.com.metaro.portal.modules.quality.checklist.entity;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_step_binding")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistStepBinding {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private Order order;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "flow_id")
    private ChecklistFlow flow;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by")
    private User createdBy;
    private Instant createdAt;
}

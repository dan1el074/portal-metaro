package br.com.metaro.portal.modules.quality.checklist.entity;

import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import jakarta.persistence.*;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "tb_checklist_step_binding_history")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistStepBindingHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "order_id")
    private Order order;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    @JoinColumn(name = "flow_id")
    private ChecklistFlow flow;
    @Column(nullable = false, length = 80)
    private String orderNumber;
    private Instant linkedAt;
    private Instant unlinkedAt;
}

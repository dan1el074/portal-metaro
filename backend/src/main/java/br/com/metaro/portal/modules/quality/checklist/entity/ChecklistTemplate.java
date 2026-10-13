package br.com.metaro.portal.modules.quality.checklist.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_template")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistTemplate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id")
    private ChecklistCategory category;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "equipment_id")
    private ChecklistEquipment equipment;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "predecessor_id")
    private ChecklistTemplate predecessor;
    private String name;
    private String titleExpression;
    @Column(name = "sections_json", columnDefinition = "TEXT")
    private String sectionsJson;
    private boolean signature;
    private boolean automatic;
    private int version;
    private int displayOrder;
    private Instant createdAt;
    private Instant updatedAt;
}

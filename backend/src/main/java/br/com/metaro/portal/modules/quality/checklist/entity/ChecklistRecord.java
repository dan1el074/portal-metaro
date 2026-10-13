package br.com.metaro.portal.modules.quality.checklist.entity;

import br.com.metaro.portal.core.entities.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_record")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "flow_id")
    private ChecklistFlow flow;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id")
    private ChecklistTemplate template;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "creator_id")
    private User creator;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finisher_id")
    private User finisher;
    @Enumerated(EnumType.STRING)
    private ChecklistStatus status;
    private boolean automatic;
    @Column(name = "answers_json", columnDefinition = "TEXT")
    private String answersJson;
    @Column(name = "fields_json", columnDefinition = "TEXT")
    private String fieldsJson;
    @Column(name = "departments_json", columnDefinition = "TEXT")
    private String departmentsJson;
    private String signature;
    private Instant signedAt;
    private Instant finishedAt;
    private Instant createdAt;
    private Instant updatedAt;
    @Version
    @Column(name = "lock_version")
    private long lockVersion;
}

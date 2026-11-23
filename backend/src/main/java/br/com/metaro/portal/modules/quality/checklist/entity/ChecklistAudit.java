package br.com.metaro.portal.modules.quality.checklist.entity;

import br.com.metaro.portal.core.entities.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_audit")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "record_id")
    private ChecklistRecord record;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;
    private String actorName;
    private String action;
    private String details;
    private Instant createdAt;
}

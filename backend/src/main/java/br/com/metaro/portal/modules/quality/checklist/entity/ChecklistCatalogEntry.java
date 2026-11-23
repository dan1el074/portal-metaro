package br.com.metaro.portal.modules.quality.checklist.entity;

import br.com.metaro.portal.core.entities.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_catalog_entry")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistCatalogEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    private ChecklistCatalogType type;
    private String name;
    private String normalizedName;
    private boolean active;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;
    private Instant createdAt;
    private Instant updatedAt;
}

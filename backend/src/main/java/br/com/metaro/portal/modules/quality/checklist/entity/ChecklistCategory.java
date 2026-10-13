package br.com.metaro.portal.modules.quality.checklist.entity;

import br.com.metaro.portal.core.entities.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "tb_checklist_category")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistCategory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String name;
    @Enumerated(EnumType.STRING)
    private ChecklistIntegration integration;
    private boolean active;
    private String deactivationReason;
    private int displayOrder;
    private boolean logo;
    private String reLabel;
    private String referenceLabel;
    private String documentTitle;
    private boolean clientNokHistory;
    private boolean dates;
    private boolean departments;
    private boolean serialRequired;
    private boolean erpRequired;
    @Column(name = "fields_json", columnDefinition = "TEXT")
    private String fieldsJson;
    private Instant createdAt;
    private Instant updatedAt;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "tb_checklist_category_access",
            joinColumns = @JoinColumn(name = "category_id"),
            inverseJoinColumns = @JoinColumn(name = "user_id"))
    private Set<User> operators = new HashSet<>();
}

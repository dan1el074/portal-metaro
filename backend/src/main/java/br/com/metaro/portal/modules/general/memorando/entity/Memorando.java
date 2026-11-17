package br.com.metaro.portal.modules.general.memorando.entity;

import br.com.metaro.portal.core.entities.Position;
import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.util.erp.ErpSource;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tb_memorando")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
@EqualsAndHashCode
public class Memorando {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long number;
    private Long request;
    private String client;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ErpSource erpSource = ErpSource.PROBUS;
    private List<String> items;
    private String title;
    @Column(columnDefinition = "TEXT")
    private String description;
    @Column(columnDefinition = "TEXT")
    private String reason;
    @Column(columnDefinition = "TEXT")
    private String publishedSnapshotJson;
    @Column(columnDefinition = "TIMESTAMP WITHOUT TIME ZONE")
    private Instant createAt;
    @Enumerated(EnumType.STRING)
    private MemorandoStatus status;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User createdBy;

    @ManyToMany
    @JoinTable(name = "tb_memorando_departments",
            joinColumns = @JoinColumn(name = "memorando_id"),
            inverseJoinColumns = @JoinColumn(name = "departments_id"))
    private List<Position> fromDepartments;

    @OneToMany(mappedBy = "memorando",
            cascade = CascadeType.ALL,
            orphanRemoval = true)
    @OrderBy("createdAt ASC")
    private List<MemorandoLog> logs;

    @OneToMany(mappedBy = "memorando",
        cascade = CascadeType.ALL,
        orphanRemoval = true)
    private List<Signature> signatures = new ArrayList<>();
}

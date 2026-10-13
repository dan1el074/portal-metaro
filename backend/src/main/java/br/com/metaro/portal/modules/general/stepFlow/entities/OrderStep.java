package br.com.metaro.portal.modules.general.stepFlow.entities;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.util.picture.Picture;
import br.com.metaro.portal.util.video.Video;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "tb_stepflow_order_step")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class OrderStep {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Enumerated(EnumType.STRING)
    private StepType step;
    @Enumerated(EnumType.STRING)
    private StepStatus status;
    @Column(nullable = false)
    private boolean checklistPending;

    // auditoria
    @Column(columnDefinition = "TIMESTAMP WITHOUT TIME ZONE")
    private Instant startedAt;
    @Column(columnDefinition = "TIMESTAMP WITHOUT TIME ZONE")
    private Instant finishedAt;

    // relacionamentos
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;
    @OneToMany(mappedBy = "step", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<StepMessage> messages = new ArrayList<>();
    @OneToMany(mappedBy = "orderStep", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Picture> pictures = new ArrayList<>();
    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "order_step_id")
    private List<Video> videos = new ArrayList<>();
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finished_by_id")
    private User finishedBy;

    public void addVideo(Video video) {
        videos.add(video);
    }
}

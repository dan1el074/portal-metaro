package br.com.metaro.portal.modules.quality.checklist.entity;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.util.picture.Picture;
import br.com.metaro.portal.util.video.Video;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_evidence")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistEvidence {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "record_id")
    private ChecklistRecord record;
    @Column(nullable = false, length = 120)
    private String problemId;
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "picture_id")
    private Picture picture;
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "video_id")
    private Video video;
    @Column(nullable = false)
    private String originalName;
    @Column(nullable = false, length = 160)
    private String contentType;
    private long size;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by")
    private User createdBy;
    private Instant createdAt;
}

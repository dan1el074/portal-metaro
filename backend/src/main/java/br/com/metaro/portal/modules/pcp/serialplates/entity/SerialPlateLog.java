package br.com.metaro.portal.modules.pcp.serialplates.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "tb_serial_plate_log")
@Getter
@Setter
public class SerialPlateLog {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(updatable = false)
    private Long serial;
    @Column(nullable = false, updatable = false)
    private Long userId;
    @Column(nullable = false, updatable = false, length = 255)
    private String author;
    @Column(nullable = false, updatable = false, columnDefinition = "TIMESTAMP WITHOUT TIME ZONE")
    private Instant at;
    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String changesJson;
}

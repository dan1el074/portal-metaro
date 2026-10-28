package br.com.metaro.portal.modules.pcp.serialplates.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "tb_serial_plate")
@Getter
@Setter
public class SerialPlate {
    @Id
    private Long serial;
    @Version
    private Long version;
    @Column(name = "manufacturing_order", nullable = false, length = 80)
    private String of = "";
    @Column(name = "order_number", nullable = false, length = 15)
    private String order = "";
    @Column(nullable = false, length = 64)
    private String orderItem = "";
    @Column(nullable = false)
    private Boolean readyStock = false;
    @Column(nullable = false, length = 500)
    private String client = "";
    @Column(nullable = false, length = 1000)
    private String description = "";
    @Column(precision = 18, scale = 6)
    private BigDecimal capacity;
    @Column(nullable = false, length = 120)
    private String voltage = "";
    @Column(precision = 18, scale = 6)
    private BigDecimal weight;
    @Column(nullable = false, length = 255)
    private String provider = "";
    @Column(nullable = false, length = 20)
    private String status = "Criado";
    @Column(nullable = false, columnDefinition = "text")
    private String notes = "";
    @Column(nullable = false, length = 7)
    private String manufactured;
    @Column(nullable = false, columnDefinition = "TIMESTAMP WITHOUT TIME ZONE")
    private Instant updated;
}

package br.com.metaro.portal.modules.general.stepFlow.entities;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "tb_stepflow_order_volume")
@NoArgsConstructor
@AllArgsConstructor
@Getter
@Setter
public class OrderVolume {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private Integer quantity = 1;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal length;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal width;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal height;
    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal weight;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;
}

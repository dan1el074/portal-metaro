package br.com.metaro.portal.modules.general.stepFlow.repositories;

import br.com.metaro.portal.modules.general.stepFlow.entities.Order;
import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus;
import br.com.metaro.portal.modules.general.stepFlow.entities.StepStatus;
import br.com.metaro.portal.modules.general.stepFlow.entities.StepType;
import br.com.metaro.portal.modules.general.stepFlow.repositories.projections.StatusCountsProjection;
import br.com.metaro.portal.modules.general.stepFlow.repositories.projections.StepCountProjection;
import br.com.metaro.portal.util.erp.ErpSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface OrderRepository extends JpaRepository<Order, Long> {
    @Query("""
        SELECT
            COUNT(o) AS totalCount,
            COALESCE(SUM(CASE
                WHEN o.status = 'IN_PROGRESS'
                    AND (o.dueDate IS NULL OR o.dueDate >= CURRENT_DATE) THEN 1
                ELSE 0
            END), 0) AS progressCount,
            COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completeCount,
            COALESCE(SUM(CASE
                WHEN o.status = 'LATE'
                    OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE) THEN 1
                ELSE 0
            END), 0) AS lateCount
        FROM Order o
    """)
    public Optional<StatusCountsProjection> findCountByStatus();

    @Query("""
        SELECT o.currentStep AS step, COUNT(o) AS count
        FROM Order o
        WHERE o.status = :status
        GROUP BY o.currentStep
    """)
    public List<StepCountProjection> findCountByStep(@Param("status") OrderStatus status);

    @Query("""
        SELECT o.currentStep AS step, COUNT(o) AS count
        FROM Order o
        WHERE o.status = 'LATE'
            OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE)
        GROUP BY o.currentStep
    """)
    public List<StepCountProjection> findLateCountByStep();

    @Query("""
        SELECT o
        FROM Order o
        JOIN o.steps s
        WHERE o.currentStep = :step
            AND s.step = :step
            AND s.status = :status
            AND s.checklistPending = false
            AND o.status <> :orderStatus
        ORDER BY o.id DESC
    """)
    public List<Order> findByCurrentStep(@Param("step") StepType step,
                                         @Param("status") StepStatus status,
                                         @Param("orderStatus") OrderStatus orderStatus);

    @Query("""
        SELECT o
        FROM Order o
        WHERE o.number = :orderNumber
            AND o.status <> :orderStatus
    """)
    public List<Order> findByNumber(Integer orderNumber, @Param("orderStatus") OrderStatus orderStatus);

    @Query("""
        SELECT o
        FROM Order o
        WHERE o.number = :orderNumber
            AND o.erpSource = :erpSource
            AND o.status <> :orderStatus
    """)
    List<Order> findByNumberAndErpSource(
            Integer orderNumber,
            @Param("erpSource") ErpSource erpSource,
            @Param("orderStatus") OrderStatus orderStatus
    );

    public long countByNumber(Integer number);

    @Query("""
        SELECT o
        FROM Order o
        WHERE
            LOWER(o.client) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(o.currentStep) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(
                CASE
                    WHEN o.status = 'LATE'
                        OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE) THEN 'LATE'
                    ELSE CAST(o.status AS string)
                END
            ) LIKE LOWER(CONCAT('%', :search, '%'))
            OR CAST(o.number AS string) LIKE CONCAT('%', :search, '%')
    """)
    public Page<Order> search(Pageable pageable, @Param("search") String search);

    @Query("""
        SELECT o
        FROM Order o
        WHERE
            LOWER(o.client) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(o.currentStep) LIKE LOWER(CONCAT('%', :search, '%'))
            OR LOWER(
                CASE
                    WHEN o.status = 'LATE'
                        OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE) THEN 'LATE'
                    ELSE CAST(o.status AS string)
                END
            ) LIKE LOWER(CONCAT('%', :search, '%'))
            OR CAST(o.number AS string) LIKE CONCAT('%', :search, '%')
        ORDER BY (
            CASE
                WHEN o.status = 'LATE'
                    OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE) THEN 0
                WHEN o.status = 'IN_PROGRESS' THEN 1
                WHEN o.status = 'CANCELLED' THEN 2
                WHEN o.status = 'COMPLETED' THEN 3
                ELSE 4
            END
        ) * :direction
    """)
    public Page<Order> searchOrderByEffectiveStatus(
            Pageable pageable,
            @Param("search") String search,
            @Param("direction") Integer direction
    );

    @Query("""
        SELECT o
        FROM Order o
        WHERE o.status <> :status
            AND LOWER(o.currentStep) = LOWER(:step)
            AND (
                LOWER(o.client) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(
                    CASE
                        WHEN o.status = 'LATE'
                            OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE) THEN 'LATE'
                        ELSE CAST(o.status AS string)
                    END
                ) LIKE LOWER(CONCAT('%', :search, '%'))
                OR CAST(o.number AS string) LIKE CONCAT('%', :search, '%')
            )
    """)
    public Page<Order> searchOnlyStep(Pageable pageable, @Param("search") String search, @Param("step") String step,
                                      @Param("status") OrderStatus status);

    @Query("""
        SELECT o
        FROM Order o
        WHERE o.status <> :status
            AND LOWER(o.currentStep) = LOWER(:step)
            AND (
                LOWER(o.client) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(
                    CASE
                        WHEN o.status = 'LATE'
                            OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE) THEN 'LATE'
                        ELSE CAST(o.status AS string)
                    END
                ) LIKE LOWER(CONCAT('%', :search, '%'))
                OR CAST(o.number AS string) LIKE CONCAT('%', :search, '%')
            )
        ORDER BY (
            CASE
                WHEN o.status = 'LATE'
                    OR (o.status = 'IN_PROGRESS' AND o.dueDate < CURRENT_DATE) THEN 0
                WHEN o.status = 'IN_PROGRESS' THEN 1
                WHEN o.status = 'CANCELLED' THEN 2
                WHEN o.status = 'COMPLETED' THEN 3
                ELSE 4
            END
        ) * :direction
    """)
    public Page<Order> searchOnlyStepOrderByEffectiveStatus(
            Pageable pageable,
            @Param("search") String search,
            @Param("step") String step,
            @Param("status") OrderStatus status,
            @Param("direction") Integer direction
    );
}

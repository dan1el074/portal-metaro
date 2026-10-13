package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStepBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ChecklistStepBindingRepository extends JpaRepository<ChecklistStepBinding, Long> {
    List<ChecklistStepBinding> findByOrderId(Long orderId);
    List<ChecklistStepBinding> findByFlowId(Long flowId);
    List<ChecklistStepBinding> findByOrderStatusNot(OrderStatus status);
    boolean existsByOrderIdAndFlowId(Long orderId, Long flowId);

    @Query("select count(b) > 0 from ChecklistStepBinding b where b.flow.id = :flowId and b.order.status <> br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus.CANCELLED and b.order.id <> :orderId")
    boolean existsByFlowIdAndNonCancelledOrderOtherThan(Long flowId, Long orderId);

    @Query("select count(b) > 0 from ChecklistStepBinding b where b.flow.id = :flowId and b.order.status <> br.com.metaro.portal.modules.general.stepFlow.entities.OrderStatus.CANCELLED")
    boolean existsByFlowIdAndNonCancelledOrder(Long flowId);
}

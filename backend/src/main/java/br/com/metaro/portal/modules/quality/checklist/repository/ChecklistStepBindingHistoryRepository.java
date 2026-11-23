package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStepBindingHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChecklistStepBindingHistoryRepository extends JpaRepository<ChecklistStepBindingHistory, Long> {
    List<ChecklistStepBindingHistory> findByFlowIdOrderByIdAsc(Long flowId);
    List<ChecklistStepBindingHistory> findByOrderIdAndFlowIdAndUnlinkedAtIsNull(Long orderId, Long flowId);
}

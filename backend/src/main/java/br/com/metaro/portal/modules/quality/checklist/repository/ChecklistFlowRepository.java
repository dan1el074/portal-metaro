package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistFlow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface ChecklistFlowRepository extends JpaRepository<ChecklistFlow, Long> {
    Optional<ChecklistFlow> findByNormalizedSerial(String normalizedSerial);
    boolean existsByNormalizedSerialAndIdNot(String normalizedSerial, Long id);
    List<ChecklistFlow> findByOrderNumberAndCancelledFalseOrderBySerialNumberAsc(String orderNumber);
}

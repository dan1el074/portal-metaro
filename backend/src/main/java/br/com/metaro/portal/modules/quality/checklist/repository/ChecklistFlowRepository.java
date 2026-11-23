package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistFlow;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.List;

public interface ChecklistFlowRepository extends JpaRepository<ChecklistFlow, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select f from ChecklistFlow f where f.id = :id")
    Optional<ChecklistFlow> findLockedById(Long id);
    Optional<ChecklistFlow> findByNormalizedSerial(String normalizedSerial);
    Optional<ChecklistFlow> findBySerialPlateIdAndCancelledFalse(Long serialPlateId);
    boolean existsByNormalizedSerialAndIdNot(String normalizedSerial, Long id);
    List<ChecklistFlow> findByOrderNumberAndCancelledFalseOrderBySerialNumberAsc(String orderNumber);
}

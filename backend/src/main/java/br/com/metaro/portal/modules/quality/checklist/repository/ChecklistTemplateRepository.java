package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChecklistTemplateRepository extends JpaRepository<ChecklistTemplate, Long> {
    List<ChecklistTemplate> findAllByOrderByDisplayOrderAscNameAsc();
    Optional<ChecklistTemplate> findByPredecessorId(Long predecessorId);
    boolean existsByPredecessorIdAndIdNot(Long predecessorId, Long id);
    boolean existsByPredecessorId(Long predecessorId);
    boolean existsByCategoryIdAndEquipmentIdAndIdNot(Long categoryId, Long equipmentId, Long id);
    boolean existsByCategoryIdAndEquipmentId(Long categoryId, Long equipmentId);
    boolean existsByCategoryId(Long categoryId);
    boolean existsByEquipmentId(Long equipmentId);
}

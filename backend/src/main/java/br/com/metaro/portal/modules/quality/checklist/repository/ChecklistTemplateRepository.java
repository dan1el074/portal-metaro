package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistTemplateSummaryDto;

import java.util.List;
import java.util.Optional;

public interface ChecklistTemplateRepository extends JpaRepository<ChecklistTemplate, Long> {
    List<ChecklistTemplate> findAllByOrderByDisplayOrderAscNameAsc();
    List<ChecklistTemplate> findByCategoryId(Long categoryId);

    @Query("""
            select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistTemplateSummaryDto(
                t.id, t.name, t.category.id, e.id, e.name, t.predecessor.id, t.version,
                case when exists (select 1 from ChecklistRecord r where r.template.id = t.id)
                    or exists (select 1 from ChecklistTemplate successor where successor.predecessor.id = t.id)
                    then true else false end)
            from ChecklistTemplate t left join t.equipment e
            order by t.displayOrder, t.name, t.id
            """)
    List<ChecklistTemplateSummaryDto> listSummaries();
    Optional<ChecklistTemplate> findByPredecessorId(Long predecessorId);
    boolean existsByPredecessorIdAndIdNot(Long predecessorId, Long id);
    boolean existsByPredecessorId(Long predecessorId);
    boolean existsByCategoryIdAndEquipmentIdAndIdNot(Long categoryId, Long equipmentId, Long id);
    boolean existsByCategoryIdAndEquipmentId(Long categoryId, Long equipmentId);
    boolean existsByCategoryId(Long categoryId);
    boolean existsByEquipmentId(Long equipmentId);
}

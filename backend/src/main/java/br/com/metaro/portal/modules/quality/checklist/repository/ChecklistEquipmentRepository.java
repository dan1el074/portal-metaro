package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistEquipment;
import org.springframework.data.jpa.repository.JpaRepository;


public interface ChecklistEquipmentRepository extends JpaRepository<ChecklistEquipment, Long> {
    boolean existsByAbbreviationIgnoreCaseAndIdNot(String abbreviation, Long id);
    boolean existsByAbbreviationIgnoreCase(String abbreviation);
}

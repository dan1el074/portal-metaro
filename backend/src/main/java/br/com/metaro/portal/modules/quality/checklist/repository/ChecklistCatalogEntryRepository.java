package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistCatalogEntry;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistCatalogType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChecklistCatalogEntryRepository extends JpaRepository<ChecklistCatalogEntry, Long> {
    List<ChecklistCatalogEntry> findByTypeAndActiveTrueOrderByNameAsc(ChecklistCatalogType type);
    List<ChecklistCatalogEntry> findByTypeOrderByNameAsc(ChecklistCatalogType type);
    boolean existsByTypeAndNormalizedNameAndIdNot(ChecklistCatalogType type, String normalizedName, Long id);
}

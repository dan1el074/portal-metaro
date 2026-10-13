package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChecklistCategoryRepository extends JpaRepository<ChecklistCategory, Long> {
    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    boolean existsByNameIgnoreCase(String name);

    @Query("select c.id from ChecklistCategory c join c.operators u where u.id = :userId")
    List<Long> findAllowedCategoryIds(Long userId);
}

package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistCategory;
import br.com.metaro.portal.modules.quality.checklist.dto.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChecklistCategoryRepository extends JpaRepository<ChecklistCategory, Long> {
    @Query("select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistCategoryTabDto(c.id, c.name) from ChecklistCategory c order by c.id")
    List<ChecklistCategoryTabDto> listTabs();

    @Query("select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistCategorySummaryDto(c.id, c.name, c.integration, c.active) from ChecklistCategory c order by c.id")
    List<ChecklistCategorySummaryDto> listSummaries();

    @Query("select c.id, c.name, c.integration, c.erpRequired, c.reLabel, c.referenceLabel, c.mediaEnabled, c.fieldsJson from ChecklistCategory c order by c.id")
    List<Object[]> listModelOptions();

    @Query("""
            select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistOperatorDto(
                u.id, u.name, coalesce(u.activated, false))
            from User u join u.roles r
            where r.authority = 'ROLE_CHECKLIST_OPERATOR'
            order by u.name, u.id
            """)
    List<ChecklistOperatorDto> listOperators();

    @Query("select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistCategoryHistoryDto(c.id, c.name, c.integration, c.clientNokHistory) from ChecklistCategory c order by c.id")
    List<ChecklistCategoryHistoryDto> listHistorySettings();

    @Query("select c.id, c.name, u.id from ChecklistCategory c left join c.operators u order by c.id, u.id")
    List<Object[]> listAccess();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ChecklistCategory c where c.id in :ids order by c.id")
    List<ChecklistCategory> findLockedByIds(List<Long> ids);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
    boolean existsByNameIgnoreCase(String name);
    boolean existsByIdAndOperatorsId(Long id, Long userId);
    boolean existsByIdAndClientNokHistoryTrue(Long id);

    @Query("select c.id from ChecklistCategory c join c.operators u where u.id = :userId")
    List<Long> findAllowedCategoryIds(Long userId);
}

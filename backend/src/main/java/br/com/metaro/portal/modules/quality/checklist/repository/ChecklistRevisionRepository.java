package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistRevision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChecklistRevisionRepository extends JpaRepository<ChecklistRevision, Long> {
    List<ChecklistRevision> findByRecordIdOrderByCreatedAtAsc(Long recordId);
    boolean existsByRecordId(Long recordId);
}

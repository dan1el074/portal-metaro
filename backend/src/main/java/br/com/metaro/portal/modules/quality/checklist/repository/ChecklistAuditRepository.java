package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ChecklistAuditRepository extends JpaRepository<ChecklistAudit, Long> {
    List<ChecklistAudit> findByRecordIdOrderByCreatedAtAsc(Long recordId);
}

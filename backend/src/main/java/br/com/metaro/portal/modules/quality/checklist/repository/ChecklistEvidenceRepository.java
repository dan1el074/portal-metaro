package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistEvidence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChecklistEvidenceRepository extends JpaRepository<ChecklistEvidence, Long> {
    List<ChecklistEvidence> findByRecordIdOrderByCreatedAtAsc(Long recordId);
    Optional<ChecklistEvidence> findByIdAndRecordId(Long id, Long recordId);
}

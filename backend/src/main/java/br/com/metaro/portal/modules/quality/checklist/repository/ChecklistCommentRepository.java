package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistComment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ChecklistCommentRepository extends JpaRepository<ChecklistComment, Long> {
    List<ChecklistComment> findByRecordIdAndActiveTrueOrderByCreatedAtAsc(Long recordId);
    Optional<ChecklistComment> findByIdAndRecordId(Long id, Long recordId);
    Optional<ChecklistComment> findByRecordIdAndProblemIdAndActiveTrue(Long recordId, String problemId);
}

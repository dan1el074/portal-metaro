package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistRecord;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChecklistRecordRepository extends JpaRepository<ChecklistRecord, Long> {
    @EntityGraph(attributePaths = {"flow", "template", "template.category", "creator", "owner", "finisher"})
    @Query("select r from ChecklistRecord r where r.id = :id")
    Optional<ChecklistRecord> findDetailedById(Long id);

    @EntityGraph(attributePaths = {"flow", "template", "template.category", "creator", "owner"})
    @Query("select r from ChecklistRecord r where r.status <> br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT or r.creator.id = :userId or :administrator = true order by r.updatedAt desc")
    Page<ChecklistRecord> findVisible(Pageable pageable, Long userId, boolean administrator);

    List<ChecklistRecord> findByFlowId(Long flowId);
    Optional<ChecklistRecord> findFirstByFlowIdOrderByIdAsc(Long flowId);
    @EntityGraph(attributePaths = {"flow", "template", "template.category", "creator", "owner", "finisher"})
    @Query("select r from ChecklistRecord r where r.flow.clientId = :clientId and r.status not in (br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT, br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.CANCELLED) order by r.updatedAt desc")
    List<ChecklistRecord> findClientHistory(String clientId);
    Optional<ChecklistRecord> findByFlowIdAndTemplateId(Long flowId, Long templateId);
    boolean existsByFlowIdAndTemplateId(Long flowId, Long templateId);
    boolean existsByFlowIdAndStatus(Long flowId, ChecklistStatus status);
    boolean existsByTemplateId(Long templateId);
}

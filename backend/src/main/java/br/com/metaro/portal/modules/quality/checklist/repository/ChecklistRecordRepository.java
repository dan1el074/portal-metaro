package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistCreationOptionDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistPredecessorDto;
import org.springframework.data.domain.Slice;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistFlowRecordSummaryDto;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistRecord;
import java.time.Instant;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus;
import org.jspecify.annotations.NonNull;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChecklistRecordRepository extends JpaRepository<ChecklistRecord, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<ChecklistRecord> {
    @Query(value = "select nextval('checklist_nested_id_seq')", nativeQuery = true)
    Long reserveNestedIds();

    String ELIGIBLE = """
            r.manualSuccessorId = t.id and r.status = FINISHED and r.flow.cancelled = false
            and not exists (select other.id from ChecklistRecord other where other.flow = r.flow
                and (other.template = t or (other.id < r.id and other.status not in (FINISHED, JUSTIFIED))))
            """;
    String OPERABLE = """
            c.active = true and (:administrator = true or exists
                (select u.id from ChecklistCategory allowed join allowed.operators u where allowed = c and u.id = :userId))
            """;

    @Query("""
            select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistCreationOptionDto(
                t.id, t.name, c.id, c.name, c.integration, c.erpRequired, c.serialRequired,
                (t.predecessor is null or t.optionalPredecessor = true),
                (t.predecessor is not null or exists (select r.id from ChecklistRecord r where
            """ + ELIGIBLE + """
                )))
            from ChecklistTemplate t join t.category c where
            """ + OPERABLE + """
            and (t.predecessor is null or t.optionalPredecessor = true or exists
                (select r.id from ChecklistRecord r where
            """ + ELIGIBLE + ")) order by c.id, t.displayOrder, t.id")
    List<ChecklistCreationOptionDto> creationOptions(Long userId, boolean administrator);

    @Query("""
            select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistPredecessorDto(
                r.id, r.flow.serialNumber, r.listingTitle, r.finishedAt)
            from ChecklistRecord r, ChecklistTemplate t join t.category c where t.id = :templateId and
            """ + OPERABLE + " and " + ELIGIBLE + " order by r.id desc")
    Slice<ChecklistPredecessorDto>
            eligiblePredecessors(Long templateId, Long userId, boolean administrator, Pageable page);

    @Override
    @EntityGraph(attributePaths = {"flow", "template", "template.category", "owner", "creator"})
    @NonNull
    Page<ChecklistRecord> findAll(org.springframework.data.jpa.domain.Specification<ChecklistRecord> spec, Pageable pageable);

    @Query("select r.listingCategoryId, count(r) from ChecklistRecord r where (r.status <> br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT or coalesce(r.owner.id, r.creator.id) = :userId or :administrator = true) and (:consultation = false or r.status <> br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT) group by r.listingCategoryId")
    List<Object[]> countVisibleCategories(Long userId, boolean administrator, boolean consultation);

    @EntityGraph(attributePaths = {"flow", "template", "template.category", "creator", "owner", "finisher"})
    @Query("select r from ChecklistRecord r where r.id = :id")
    Optional<ChecklistRecord> findDetailedById(Long id);

    @EntityGraph(attributePaths = {"flow", "owner"})
    @Query("select r from ChecklistRecord r where r.id = :id")
    Optional<ChecklistRecord> findContextById(Long id);

    @Query("""
            select r.flow.orderNumber, r.flow.commercialItemCode from ChecklistRecord r where r.id = :id
            and (r.status <> br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT
                or coalesce(r.owner.id, r.creator.id) = :userId or :administrator = true)
            """)
    List<Object[]> findVisibleOrderItem(Long id, Long userId, boolean administrator);

    @EntityGraph(attributePaths = {"flow", "template", "template.category", "creator", "owner"})
    @Query("select r from ChecklistRecord r where r.status <> br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT or coalesce(r.owner.id, r.creator.id) = :userId or :administrator = true order by r.updatedAt desc")
    Page<ChecklistRecord> findVisible(Pageable pageable, Long userId, boolean administrator);

    @Query("""
            select new br.com.metaro.portal.modules.quality.checklist.dto.ChecklistFlowRecordSummaryDto(
                r.template.id, r.id, r.status, coalesce(r.owner.id, r.creator.id))
            from ChecklistRecord r where r.flow.id = :flowId
            """)
    List<ChecklistFlowRecordSummaryDto> findFlowSummaries(Long flowId);

    @Query("""
            select r.id from ChecklistRecord r
            where (r.status <> br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT
                or coalesce(r.owner.id, r.creator.id) = :userId or :administrator = true)
              and (r.updatedAt > :updated or (r.updatedAt = :updated and r.id > :id))
            order by r.updatedAt asc, r.id asc
            """)
    List<Long> findPreviousVisibleId(Instant updated, Long id, Long userId, boolean administrator, Pageable limit);

    @Query("""
            select r.id from ChecklistRecord r
            where (r.status <> br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus.DRAFT
                or coalesce(r.owner.id, r.creator.id) = :userId or :administrator = true)
              and (r.updatedAt < :updated or (r.updatedAt = :updated and r.id < :id))
            order by r.updatedAt desc, r.id desc
            """)
    List<Long> findNextVisibleId(Instant updated, Long id, Long userId, boolean administrator, Pageable limit);

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

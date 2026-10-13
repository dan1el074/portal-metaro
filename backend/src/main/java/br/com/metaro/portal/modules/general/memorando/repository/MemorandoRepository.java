package br.com.metaro.portal.modules.general.memorando.repository;

import br.com.metaro.portal.modules.general.memorando.entity.Memorando;
import br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus;
import br.com.metaro.portal.modules.general.memorando.repository.projections.MemorandoPendingProjection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemorandoRepository extends JpaRepository<Memorando, Long> {
    @Query("""
        SELECT m
        FROM Memorando m
        WHERE (:admin = true
            OR m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED
            OR m.createdBy.id = :userId)
            AND ((:draft = true AND m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED)
                OR (:draft = false AND m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED))
            AND (:status IS NULL OR m.status = :status)
            AND (:search = '' OR
                LOWER(m.client) LIKE LOWER(CONCAT('%', :search, '%'))
                OR CAST(m.request AS string) LIKE CONCAT('%', :search, '%')
                OR CAST(m.number AS string) LIKE CONCAT('%', :search, '%')
                OR LOWER(CASE
                    WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED THEN 'rascunho salvo'
                    WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.PUBLISH THEN 'ativo publicado'
                    WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.APPROVED THEN 'aprovado'
                    WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CANCELED THEN 'cancelado'
                    ELSE '' END) LIKE LOWER(CONCAT('%', :search, '%')))
    """)
    Page<Memorando> search(
            Pageable pageable,
            @Param("search") String search,
            @Param("draft") boolean draft,
            @Param("status") MemorandoStatus status,
            @Param("admin") boolean admin,
            @Param("userId") Long userId
    );

    @Query("""
        SELECT m
        FROM Memorando m
        WHERE (:admin = true
            OR m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED
            OR m.createdBy.id = :userId)
            AND ((:draft = true AND m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED)
                OR (:draft = false AND m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED))
            AND (:status IS NULL OR m.status = :status)
            AND (LOWER(m.client) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(m.title) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(m.description) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(m.reason) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(CAST(m.items AS string)) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(m.createdBy.name) LIKE LOWER(CONCAT('%', :search, '%')))
    """)
    Page<Memorando> searchExtended(
            Pageable pageable,
            @Param("search") String search,
            @Param("draft") boolean draft,
            @Param("status") MemorandoStatus status,
            @Param("admin") boolean admin,
            @Param("userId") Long userId
    );

    @Query(value = """
        SELECT
            m.id,
            m.number,
            m.request,
            m.client,
            m.erp_source,
            m.items,
            m.title,
            m.description,
            m.reason,
            m.create_at,
            m.status,
            m.user_id
        FROM tb_memorando m
        INNER JOIN tb_user u ON u.id = m.user_id
        WHERE (:admin = true OR m.status <> 'CREATED' OR m.user_id = :userId)
            AND ((:draft = true AND m.status = 'CREATED') OR (:draft = false AND m.status <> 'CREATED'))
            AND (:status = '' OR m.status = :status)
            AND (
                m.search_vector @@ websearch_to_tsquery('portuguese', :search)
                OR to_tsvector('portuguese', COALESCE(u.name, ''))
                    @@ websearch_to_tsquery('portuguese', :search)
            )
        ORDER BY GREATEST(
            ts_rank_cd(m.search_vector, websearch_to_tsquery('portuguese', :search)),
            ts_rank_cd(
                to_tsvector('portuguese', COALESCE(u.name, '')),
                websearch_to_tsquery('portuguese', :search)
            )
        ) DESC, m.create_at DESC NULLS LAST, m.id DESC
    """, countQuery = """
        SELECT COUNT(*)
        FROM tb_memorando m
        INNER JOIN tb_user u ON u.id = m.user_id
        WHERE (:admin = true OR m.status <> 'CREATED' OR m.user_id = :userId)
            AND ((:draft = true AND m.status = 'CREATED') OR (:draft = false AND m.status <> 'CREATED'))
            AND (:status = '' OR m.status = :status)
            AND (
                m.search_vector @@ websearch_to_tsquery('portuguese', :search)
                OR to_tsvector('portuguese', COALESCE(u.name, ''))
                    @@ websearch_to_tsquery('portuguese', :search)
            )
    """, nativeQuery = true)
    Page<Memorando> searchFullText(
            Pageable pageable,
            @Param("search") String search,
            @Param("draft") boolean draft,
            @Param("status") String status,
            @Param("admin") boolean admin,
            @Param("userId") Long userId
    );

    @Query("""
        SELECT
            COALESCE(SUM(CASE WHEN m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED THEN 1 ELSE 0 END), 0) AS total,
            COALESCE(SUM(CASE WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.PUBLISH THEN 1 ELSE 0 END), 0) AS active,
            COALESCE(SUM(CASE WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.APPROVED THEN 1 ELSE 0 END), 0) AS approved,
            COALESCE(SUM(CASE WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CANCELED THEN 1 ELSE 0 END), 0) AS canceled,
            COALESCE(SUM(CASE WHEN m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED THEN 1 ELSE 0 END), 0) AS draft
        FROM Memorando m
        WHERE (:admin = true
            OR m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED
            OR m.createdBy.id = :userId)
    """)
    br.com.metaro.portal.modules.general.memorando.repository.projections.MemorandoSummaryProjection findSummary(
            @Param("admin") boolean admin,
            @Param("userId") Long userId
    );

    @Query("""
        SELECT m.id
        FROM Memorando m
        WHERE (:admin = true
            OR m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED
            OR m.createdBy.id = :userId)
            AND ((:draft = true AND m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED)
                OR (:draft = false AND m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED))
            AND m.id < :id
        ORDER BY m.id DESC
    """)
    List<Long> findPreviousAccessibleId(
            @Param("id") Long id,
            @Param("draft") boolean draft,
            @Param("admin") boolean admin,
            @Param("userId") Long userId,
            Pageable pageable
    );

    @Query("""
        SELECT m.id
        FROM Memorando m
        WHERE (:admin = true
            OR m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED
            OR m.createdBy.id = :userId)
            AND ((:draft = true AND m.status = br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED)
                OR (:draft = false AND m.status <> br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus.CREATED))
            AND m.id > :id
        ORDER BY m.id ASC
    """)
    List<Long> findNextAccessibleId(
            @Param("id") Long id,
            @Param("draft") boolean draft,
            @Param("admin") boolean admin,
            @Param("userId") Long userId,
            Pageable pageable
    );

    @Query("""
        SELECT DISTINCT m
        FROM Memorando m
        LEFT JOIN FETCH m.fromDepartments d
        WHERE m.id = :id
    """)
    public Optional<Memorando> findByIdWithDepartments(Long id);

    @Query("""
        SELECT m FROM Memorando m
        WHERE m.id IN :ids
    """)
    public List<Memorando> findAllByIds(@Param("ids") List<Long> ids);

    @Query("""
        SELECT
            m.id AS id,
            m.number AS number,
            m.createAt AS createAt
        FROM Memorando m
        WHERE m.id IN :ids
    """)
    List<MemorandoPendingProjection> findPendingByIds(@Param("ids") List<Long> ids);

    public Long countByStatus(MemorandoStatus status);
}

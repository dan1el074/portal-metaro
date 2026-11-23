package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistRecordRepository;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import org.springframework.data.support.PageableExecutionUtils;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChecklistListingService {
    private final ChecklistRecordRepository repository;
    private final UserService users;
    private final EntityManager entityManager;
    private static final Map<String, String> SORTS = Map.of("id", "id", "number", "id", "title", "listingTitle",
            "category", "listingCategoryName", "model", "listingModelName", "status", "status", "updated", "updatedAt");
    private static final Map<ChecklistStatus, String> STATUSES = Map.of(ChecklistStatus.DRAFT, "Rascunho",
            ChecklistStatus.IN_PROGRESS, "Em andamento", ChecklistStatus.PENDING, "Pendente", ChecklistStatus.FINISHED, "Finalizado",
            ChecklistStatus.JUSTIFIED, "Justificado", ChecklistStatus.CANCELLED, "Cancelado");

    public Page<ChecklistTableRowDto> list(Pageable pageable, Long categoryId, String search, String status, boolean consultation, boolean actionable) {
        var user = users.authenticate();
        boolean admin = user.hasRole("ROLE_ADMIN") || user.hasRole("ROLE_CHECKLIST_ADMIN");
        ChecklistStatus selected = null;
        if (status != null && !status.isBlank()) {
            selected = STATUSES.entrySet().stream().filter(e -> e.getValue().equals(status) || e.getKey().name().equals(status))
                    .map(Map.Entry::getKey).findFirst().orElseThrow(() -> new UnprocessableEntityException("Status inválido."));
        }
        final ChecklistStatus selectedStatus = selected;
        Specification<ChecklistRecord> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.or(cb.notEqual(root.get("status"), ChecklistStatus.DRAFT),
                    cb.equal(cb.coalesce(root.get("owner").get("id"), root.get("creator").get("id")), user.getId()), cb.isTrue(cb.literal(admin))));
            if (consultation) predicates.add(cb.notEqual(root.get("status"), ChecklistStatus.DRAFT));
            if (categoryId != null) predicates.add(cb.equal(root.get("listingCategoryId"), categoryId));
            if (selectedStatus != null) predicates.add(cb.equal(root.get("status"), selectedStatus));
            if (actionable) {
                predicates.add(root.get("status").in(ChecklistStatus.DRAFT, ChecklistStatus.IN_PROGRESS));
                if (!admin) {
                    var operators = root.join("template").join("category").join("operators");
                    predicates.add(cb.equal(operators.get("id"), user.getId()));
                    predicates.add(cb.or(cb.isNull(root.get("owner")), cb.equal(root.get("owner").get("id"), user.getId())));
                }
            }
            if (search != null && !search.isBlank()) {
                String term = "%" + search.trim().toLowerCase(Locale.ROOT).replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("listingTitle")), term, '!'),
                        cb.like(cb.lower(root.get("listingCategoryName")), term, '!'),
                        cb.like(cb.lower(root.get("listingModelName")), term, '!'),
                        cb.like(cb.lower(root.get("flow").get("serialNumber")), term, '!')));
            }
            if (query.getResultType() != Long.class && query.getResultType() != long.class) {
                var ordering = new ArrayList<jakarta.persistence.criteria.Order>();
                Sort requested = pageable.getSort().isSorted() ? pageable.getSort() : Sort.by(Sort.Order.desc("updated"));
                for (Sort.Order order : requested) {
                    jakarta.persistence.criteria.Expression<?> expression;
                    if (order.getProperty().equals("status")) {
                        var labels = cb.<ChecklistStatus, String>selectCase(root.get("status"));
                        for (var entry : STATUSES.entrySet()) labels.when(entry.getKey(), entry.getValue());
                        expression = labels.otherwise("");
                    } else {
                        jakarta.persistence.criteria.Path<?> path = root;
                        for (String property : SORTS.getOrDefault(order.getProperty(), "updatedAt").split("\\.")) path = path.get(property);
                        expression = path;
                    }
                    ordering.add(order.isAscending() ? cb.asc(expression) : cb.desc(expression));
                }
                ordering.add(cb.desc(root.get("id")));
                query.orderBy(ordering);
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var page = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 200));
        var builder = entityManager.getCriteriaBuilder();
        var query = builder.createTupleQuery();
        var record = query.from(ChecklistRecord.class);
        var flow = record.join("flow");
        query.select(builder.tuple(
                record.get("id").alias("id"), record.get("listingTitle").alias("title"),
                record.get("listingModelName").alias("model"), record.get("status").alias("status"),
                record.get("updatedAt").alias("updated"), record.get("listingCategoryId").alias("categoryId"),
                flow.get("serialNumber").alias("serial"), flow.get("orderNumber").alias("order"),
                record.get("listingCategoryName").alias("category")));
        query.where(spec.toPredicate(record, query, builder));

        var rows = entityManager.createQuery(query)
                .setFirstResult(Math.toIntExact(page.getOffset()))
                .setMaxResults(page.getPageSize())
                .getResultList().stream().map(this::row).toList();
        return PageableExecutionUtils.getPage(rows, page, () -> repository.count(spec));
    }

    public Map<String, Long> counts(boolean consultation) {
        var user = users.authenticate();
        Map<String, Long> counts = new HashMap<>();
        repository.countVisibleCategories(user.getId(), user.hasRole("ROLE_ADMIN") || user.hasRole("ROLE_CHECKLIST_ADMIN"), consultation)
                .forEach(row -> counts.put(row[0].toString(), ((Number) row[1]).longValue()));
        return counts;
    }

    private ChecklistTableRowDto row(Tuple result) {
        return new ChecklistTableRowDto(result.get("id").toString(), result.get("title", String.class),
                result.get("category", String.class), result.get("categoryId").toString(), result.get("model", String.class),
                result.get("serial", String.class), result.get("order", String.class),
                STATUSES.get(result.get("status", ChecklistStatus.class)), result.get("updated", Instant.class));
    }
}

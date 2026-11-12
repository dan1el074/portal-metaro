package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.entity.*;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistRecordRepository;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import com.fasterxml.jackson.core.type.TypeReference;
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
    private final ChecklistMapper mapper;
    private static final Map<String, String> SORTS = Map.of("number", "id", "title", "listingTitle",
            "category", "template.category.name", "model", "template.name", "status", "status", "updated", "updatedAt");
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
                    cb.equal(root.get("creator").get("id"), user.getId()), cb.isTrue(cb.literal(admin))));
            if (consultation) predicates.add(cb.notEqual(root.get("status"), ChecklistStatus.DRAFT));
            if (categoryId != null) predicates.add(cb.equal(root.get("template").get("category").get("id"), categoryId));
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
                        cb.like(cb.lower(root.get("template").get("name")), term, '!'),
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
        return repository.findAll(spec, PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 200))).map(this::row);
    }

    public Map<String, Long> counts(boolean consultation) {
        var user = users.authenticate();
        Map<String, Long> counts = new HashMap<>();
        repository.countVisibleCategories(user.getId(), user.hasRole("ROLE_ADMIN") || user.hasRole("ROLE_CHECKLIST_ADMIN"), consultation)
                .forEach(row -> counts.put(row[0].toString(), ((Number) row[1]).longValue()));
        return counts;
    }

    private ChecklistTableRowDto row(ChecklistRecord record) {
        List<ChecklistSnapshotDto> plan = mapper.read(record.getFlow().getPlanJson(), new TypeReference<>() {});
        var snapshot = plan.stream().filter(step -> step.getTemplate().getId().equals(record.getTemplate().getId())).findFirst().orElseThrow();
        return new ChecklistTableRowDto(record.getId().toString(), record.getId(), record.getListingTitle(), snapshot.getCategory().getName(),
                snapshot.getCategory().getId().toString(), snapshot.getTemplate().getName(), snapshot.getEquipment(),
                snapshot.getTemplate().getEquipmentId() == null ? "" : snapshot.getTemplate().getEquipmentId().toString(),
                record.getFlow().getSerialNumber(), record.getFlow().getOrderNumber(), STATUSES.get(record.getStatus()), record.getUpdatedAt());
    }
}

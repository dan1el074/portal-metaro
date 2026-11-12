package br.com.metaro.portal.modules.general.rawMaterials.service;

import br.com.metaro.portal.core.entities.*;
import br.com.metaro.portal.core.repositories.*;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.*;
import br.com.metaro.portal.modules.general.rawMaterials.dto.*;
import br.com.metaro.portal.modules.general.rawMaterials.entities.*;
import br.com.metaro.portal.modules.general.rawMaterials.repositories.*;
import br.com.metaro.portal.modules.general.rawMaterials.repositories.projections.RawMaterialOperatorProjection;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class RawMaterialsService {
    public static final String HISTORY_RETENTION_PARAM = "rawMaterialsHistoryRetention";
    private static final List<String> DIMENSION_FIELDS = List.of(
            "length", "width", "thickness", "height", "weightPerSquareMeter", "litersPerUnit", "weightPerLinearMeter"
    );
    private final RawMaterialRepository materialRepository;
    private final RawMaterialCategoryRepository categoryRepository;
    private final RawMaterialHistoryRepository historyRepository;
    private final UserRepository userRepository;
    private final ParamRepository paramRepository;
    private final UserService userService;
    private final TaskScheduler taskScheduler;
    private final RawMaterialStockAlertScheduler stockAlertScheduler;

    @Transactional(readOnly = true)
    public Page<RawMaterialDto> list(Pageable pageable, String search, String category, String status, boolean inactive) {
        User me = userService.authenticate();
        Pageable safePageable = sanitizePageable(pageable);
        String safeSearch = search == null ? "" : search.trim();
        String safeCategory = category == null ? "" : category.trim();
        String safeStatus = status == null || status.equalsIgnoreCase("all")
                ? null
                : status.toLowerCase(Locale.ROOT);

        if (safeStatus != null && !Set.of("low", "ok", "high").contains(safeStatus)) {
            throw new UnprocessableEntityException("Filtro de estoque inválido.");
        }

        if (isOnlyOperator(me)) {
            List<Long> allowed = allowedCategoryIds(me.getId());
            if (allowed.isEmpty()) return Page.empty(safePageable);
            return materialRepository
                    .searchAllowed(safePageable, safeSearch, safeCategory, safeStatus, !inactive, allowed)
                    .map(RawMaterialDto::new);
        }

        return materialRepository
                .search(safePageable, safeSearch, safeCategory, safeStatus, !inactive)
                .map(RawMaterialDto::new);
    }

    @Transactional(readOnly = true)
    public RawMaterialDto findById(Long id) {
        RawMaterial item = findItem(id);
        assertCategoryAccess(item.getCategory().getId());
        return new RawMaterialDto(item);
    }

    @Transactional(readOnly = true)
    public RawMaterialSummaryDto summary() {
        return new RawMaterialSummaryDto(materialRepository.summarize());
    }

    @Transactional(readOnly = true)
    public List<RawMaterialCategoryDto> categories() {
        return categoryRepository.findAll(Sort.by(Sort.Direction.ASC, "name"))
                .stream().map(RawMaterialCategoryDto::new).toList();
    }

    @Transactional
    public RawMaterialDto create(RawMaterialInputDto dto) {
        validateInput(dto, 0L);
        User me = userService.authenticate();
        RawMaterial item = new RawMaterial();
        copy(dto, item);
        item.setUpdatedBy(me);
        item = materialRepository.save(item);
        addHistory(item, "CREATED", null, item.getCurrentStorage(), me);

        return new RawMaterialDto(item);
    }

    @Transactional
    public RawMaterialDto update(Long id, RawMaterialInputDto dto) {
        validateInput(dto, id);
        RawMaterial item = findItem(id);
        BigDecimal previous = item.getCurrentStorage();
        BigDecimal previousMinimum = item.getMinStorage();
        List<String> changedFields = changedFields(item, dto);
        if (changedFields.isEmpty()) return new RawMaterialDto(item);

        User me = userService.authenticate();
        copy(dto, item);
        item.setUpdatedBy(me);
        materialRepository.save(item);
        addHistory(item, previous.compareTo(item.getCurrentStorage()) == 0 ? "UPDATED" : "STOCK_AND_ITEM_UPDATED",
                previous, item.getCurrentStorage(), changedFields, me);
        scheduleLowStockAlert(item, previous, previousMinimum);

        return new RawMaterialDto(item);
    }

    @Transactional
    public RawMaterialDto updateStock(Long id, RawMaterialStockDto dto) {
        RawMaterial item = findItem(id);
        assertStockAccess(item.getCategory().getId());

        if (!item.getActive()) throw new UnprocessableEntityException("Não é possível movimentar um item desativado.");

        User me = userService.authenticate();
        BigDecimal previous = item.getCurrentStorage();
        item.setCurrentStorage(dto.getCurrentStorage());
        item.setUpdatedBy(me);
        materialRepository.save(item);
        addHistory(item, "STOCK_UPDATED", previous, item.getCurrentStorage(), List.of(), me);
        scheduleLowStockAlert(item, previous, item.getMinStorage());

        return new RawMaterialDto(item);
    }

    @Transactional(readOnly = true)
    public Page<RawMaterialHistoryDto> history(Long id, Pageable pageable) {
        RawMaterial item = findItem(id);
        assertCategoryAccess(item.getCategory().getId());
        Pageable sorted = PageRequest.of(pageable.getPageNumber(), Math.clamp(pageable.getPageSize(), 1, 100),
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id")));

        return historyRepository.findHistory(id, sorted).map(RawMaterialHistoryDto::new);
    }

    @Transactional
    public RawMaterialCategoryDto createCategory(RawMaterialCategoryInputDto dto) {
        validateCategory(dto.getName(), 0L);
        String dimensionFields = normalizeDimensionFields(dto.getDimensionFields());
        validateConversionFactor(dto.getConversionFactor(), dimensionFields);
        RawMaterialCategory category = new RawMaterialCategory();
        category.setName(dto.getName().trim());
        category.setConversionFactor(normalizeFormula(dto.getConversionFactor()));
        category.setDimensionFields(dimensionFields);

        if (Boolean.TRUE.equals(dto.getReleaseToAll())) {
            for (RawMaterialOperatorProjection operator : userRepository.findRawMaterialOperators()) {
                category.getUsersWithAccess().add(userRepository.getReferenceById(operator.getId()));
            }
        }

        category = categoryRepository.save(category);
        return new RawMaterialCategoryDto(category);
    }

    @Transactional
    public RawMaterialCategoryDto updateCategory(Long id, RawMaterialCategoryInputDto dto) {
        validateCategory(dto.getName(), id);
        String dimensionFields = normalizeDimensionFields(dto.getDimensionFields());
        validateConversionFactor(dto.getConversionFactor(), dimensionFields);
        RawMaterialCategory category = categoryRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
        category.setName(dto.getName().trim());
        category.setConversionFactor(normalizeFormula(dto.getConversionFactor()));
        category.setDimensionFields(dimensionFields);
        return new RawMaterialCategoryDto(categoryRepository.save(category));
    }

    @Transactional
    public void deleteCategory(Long id) {
        if (!categoryRepository.existsById(id)) {
            throw new ResourceNotFoundException();
        }
        if (materialRepository.countByCategoryId(id) > 0) {
            throw new UnprocessableEntityException("A categoria possui itens vinculados e não pode ser apagada.");
        }

        categoryRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<RawMaterialUserAccessDto> users() {
        List<Long> allCategoryIds = categoryRepository.findAll().stream().map(RawMaterialCategory::getId).toList();

        return userRepository.findRawMaterialOperators().stream().map(user -> {
            Set<Long> allowedIds = new HashSet<>(categoryRepository.findAllowedCategoryIds(user.getId()));
            List<Long> allowed = allCategoryIds.stream().filter(allowedIds::contains).toList();
            return new RawMaterialUserAccessDto(user.getId(), user.getName(), user.getPictureId(), allowed);
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<Long> myCategoryIds() {
        return allowedCategoryIds(userService.authenticate().getId());
    }

    @Transactional
    public void updateAccess(RawMaterialAccessUpdateDto dto) {
        List<RawMaterialCategory> categories = categoryRepository.findAll();
        Set<Long> allCategories = new HashSet<>();
        categories.forEach(category -> allCategories.add(category.getId()));
        Set<Long> operators = new HashSet<>();
        userRepository.findRawMaterialOperators().forEach(user -> operators.add(user.getId()));

        for (UserCategoriesDto input : dto.getUsers()) {
            if (!operators.contains(input.getId())) {
                throw new UnprocessableEntityException("Usuário sem perfil de operador de matérias-primas.");
            }
            if (!allCategories.containsAll(input.getCategoryIds())) {
                throw new UnprocessableEntityException("Categoria inválida no controle de acesso.");
            }

            Set<Long> allowed = new HashSet<>(input.getCategoryIds());
            User user = userRepository.getReferenceById(input.getId());
            for (RawMaterialCategory category : categories) {
                category.getUsersWithAccess().removeIf(existing -> existing.getId().equals(input.getId()));
                if (allowed.contains(category.getId())) category.getUsersWithAccess().add(user);
            }
        }
    }

    @Transactional(readOnly = true)
    public RawMaterialHistoryRetentionDto getRetention() {
        return new RawMaterialHistoryRetentionDto(retentionLimit());
    }

    @Transactional
    public RawMaterialHistoryRetentionDto updateRetention(RawMaterialHistoryRetentionDto dto) {
        Param param = paramRepository.findByName(HISTORY_RETENTION_PARAM).orElseGet(() ->
                new Param(null, HISTORY_RETENTION_PARAM, "1000"));
        param.setContent(dto.getValue().toString());
        paramRepository.save(param);
        return dto;
    }

    private void copy(RawMaterialInputDto dto, RawMaterial item) {
        item.setCode(dto.getCode().trim());
        item.setName(dto.getName().trim());
        item.setCurrentStorage(dto.getCurrentStorage());
        item.setMinStorage(dto.getMinStorage());
        item.setMaxStorage(dto.getMaxStorage());
        item.setLength(zeroIfNull(dto.getLength()));
        item.setWidth(zeroIfNull(dto.getWidth()));
        item.setThickness(zeroIfNull(dto.getThickness()));
        item.setHeight(zeroIfNull(dto.getHeight()));
        item.setWeightPerSquareMeter(zeroIfNull(dto.getWeightPerSquareMeter()));
        item.setLitersPerUnit(zeroIfNull(dto.getLitersPerUnit()));
        item.setWeightPerLinearMeter(zeroIfNull(dto.getWeightPerLinearMeter()));
        item.setActive(dto.getActive());
        item.setCategory(categoryRepository.findById(dto.getCategoryId()).orElseThrow(ResourceNotFoundException::new));
        item.setDescription(dto.getDescription() == null || dto.getDescription().isBlank()
                ? null
                : dto.getDescription().trim());
    }

    private void validateInput(RawMaterialInputDto dto, Long id) {
        if (
            dto.getMinStorage().signum() > 0
            && dto.getMaxStorage().signum() > 0
            && dto.getMaxStorage().compareTo(dto.getMinStorage()) < 0
        ) {
            throw new UnprocessableEntityException("O estoque máximo deve ser igual ou maior que o mínimo.");
        }

        if (materialRepository.existsByCodeIgnoreCaseAndIdNot(dto.getCode().trim(), id)) {
            throw new UnprocessableEntityException("Já existe um item com este código.");
        }
    }

    private void validateCategory(String name, Long id) {
        if (categoryRepository.existsByNameIgnoreCaseAndIdNot(name.trim(), id)) {
            throw new UnprocessableEntityException("Já existe uma categoria com este nome.");
        }
    }

    private void validateConversionFactor(String formula, String dimensionFields) {
        if (formula == null || formula.isBlank()) return;
        Map<Character, String> dimensionByVariable = Map.of(
                'c', "length",
                'l', "width",
                'e', "thickness",
                'a', "height",
                'p', "weightPerSquareMeter",
                'u', "litersPerUnit",
                'm', "weightPerLinearMeter"
        );
        Set<String> activeFields = new HashSet<>(Arrays.asList(dimensionFields.split(",")));
        String normalizedFormula = formula.toLowerCase(Locale.ROOT);
        for (Map.Entry<Character, String> variable : dimensionByVariable.entrySet()) {
            if (normalizedFormula.contains("%" + variable.getKey()) && !activeFields.contains(variable.getValue())) {
                throw new UnprocessableEntityException(
                        "A variável %" + variable.getKey() + " não pode ser usada porque o campo correspondente não está ativo."
                );
            }
        }
        try {
            RawMaterialConversionFormula.validate(formula);
        } catch (IllegalArgumentException exception) {
            throw new UnprocessableEntityException("Fator de conversão inválido: " + exception.getMessage());
        }
    }

    private String normalizeFormula(String formula) {
        return formula == null || formula.isBlank() ? null : formula.trim();
    }

    private String normalizeDimensionFields(List<String> fields) {
        List<String> values = fields == null ? DIMENSION_FIELDS : fields.stream().distinct().toList();
        if (!DIMENSION_FIELDS.containsAll(values)) {
            throw new UnprocessableEntityException("Há campos inválidos na configuração da categoria.");
        }
        return String.join(",", DIMENSION_FIELDS.stream().filter(values::contains).toList());
    }

    private RawMaterial findItem(Long id) {
        return materialRepository.findById(id).orElseThrow(ResourceNotFoundException::new);
    }

    private void addHistory(RawMaterial item, String action, BigDecimal previous, BigDecimal current, User user) {
        addHistory(item, action, previous, current, List.of(), user);
    }

    private void scheduleLowStockAlert(RawMaterial item, BigDecimal previousStorage, BigDecimal previousMinimum) {
        if (crossedBelowMinimum(previousStorage, previousMinimum, item.getCurrentStorage(), item.getMinStorage())) {
            Long itemId = item.getId();
            taskScheduler.schedule(() -> stockAlertScheduler.executeSchedule(itemId), Instant.now().plusSeconds(1));
        }
    }

    static boolean crossedBelowMinimum(BigDecimal previousStorage, BigDecimal previousMinimum,
                                       BigDecimal currentStorage, BigDecimal currentMinimum) {
        return previousStorage.compareTo(currentStorage) != 0
                && previousStorage.compareTo(previousMinimum) >= 0
                && currentStorage.compareTo(currentMinimum) < 0;
    }

    private void addHistory(RawMaterial item, String action, BigDecimal previous, BigDecimal current,
                            List<String> changedFields, User user) {
        String fields = changedFields.isEmpty() ? null : String.join("|", changedFields);
        historyRepository.save(new RawMaterialHistory(null, action, previous, current, fields, Instant.now(), item, user));
        historyRepository.flush();
        historyRepository.trim(item.getId(), retentionLimit());
    }

    private List<String> changedFields(RawMaterial item, RawMaterialInputDto dto) {
        List<String> fields = new ArrayList<>();
        if (!sameText(item.getCode(), dto.getCode())) fields.add("Código");
        if (!sameText(item.getName(), dto.getName())) fields.add("Descrição do item");
        if (!sameText(item.getDescription(), dto.getDescription())) fields.add("Aplicação / observação");
        if (!sameDecimal(item.getCurrentStorage(), dto.getCurrentStorage())) fields.add("Estoque atual");
        if (!sameDecimal(item.getMinStorage(), dto.getMinStorage())) fields.add("Estoque mínimo");
        if (!sameDecimal(item.getMaxStorage(), dto.getMaxStorage())) fields.add("Estoque máximo");
        if (!sameDecimal(item.getLength(), dto.getLength())) fields.add("Comprimento");
        if (!sameDecimal(item.getWidth(), dto.getWidth())) fields.add("Largura");
        if (!sameDecimal(item.getThickness(), dto.getThickness())) fields.add("Espessura");
        if (!sameDecimal(item.getHeight(), dto.getHeight())) fields.add("Altura");
        if (!sameDecimal(item.getWeightPerSquareMeter(), dto.getWeightPerSquareMeter())) fields.add("Peso por metro quadrado");
        if (!sameDecimal(item.getLitersPerUnit(), dto.getLitersPerUnit())) fields.add("Litros por unidade");
        if (!sameDecimal(item.getWeightPerLinearMeter(), dto.getWeightPerLinearMeter())) fields.add("Peso por metro linear");
        if (!Objects.equals(item.getCategory().getId(), dto.getCategoryId())) fields.add("Categoria");
        if (!Objects.equals(item.getActive(), dto.getActive())) fields.add("Situação do item");
        return fields;
    }

    private boolean sameText(String current, String updated) {
        return Objects.equals(current == null ? "" : current.trim(), updated == null ? "" : updated.trim());
    }

    private boolean sameDecimal(BigDecimal current, BigDecimal updated) {
        return zeroIfNull(current).compareTo(zeroIfNull(updated)) == 0;
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private int retentionLimit() {
        return paramRepository.findByName(HISTORY_RETENTION_PARAM).map(Param::getContent).map(value -> {
            try { return Math.max(10, Integer.parseInt(value)); } catch (NumberFormatException ignored) { return 1000; }
        }).orElse(1000);
    }

    private List<Long> allowedCategoryIds(Long userId) {
        return categoryRepository.findAllowedCategoryIds(userId);
    }

    private void assertCategoryAccess(Long categoryId) {
        User me = userService.authenticate();

        if (isOnlyOperator(me) && !allowedCategoryIds(me.getId()).contains(categoryId)) {
            throw new ForbiddenException("Você não tem acesso a esta categoria.");
        }
    }

    private void assertStockAccess(Long categoryId) {
        User me = userService.authenticate();
        boolean globalAdministrator = me.hasRole("ROLE_ADMIN") || me.hasRole("ROLE_RAW_MATERIALS_ADMIN");

        if (!globalAdministrator && me.hasRole("ROLE_RAW_MATERIALS_OPERATOR")
                && !allowedCategoryIds(me.getId()).contains(categoryId)) {
            throw new ForbiddenException("Você não tem acesso para movimentar esta categoria.");
        }
    }

    private boolean isOnlyOperator(User user) {
        return user.hasRole("ROLE_RAW_MATERIALS_OPERATOR")
                && !user.hasRole("ROLE_ADMIN")
                && !user.hasRole("ROLE_RAW_MATERIALS_ADMIN")
                && !user.hasRole("ROLE_RAW_MATERIALS_CONSULTATION");
    }

    private Pageable sanitizePageable(Pageable pageable) {
        Map<String, String> allowed = Map.of("id", "id", "code", "code", "name", "name", "currentStorage", "currentStorage",
                "currentStorageKg", "currentStorage", "minStorage", "minStorage", "minStorageKg", "minStorage",
                "maxStorage", "maxStorage", "maxStorageKg", "maxStorage", "updateAt", "updatedAt");
        List<Sort.Order> orders = pageable.getSort().stream().filter(order -> allowed.containsKey(order.getProperty()))
                .map(order -> new Sort.Order(order.getDirection(), allowed.get(order.getProperty()))).toList();
        Sort sort = orders.isEmpty() ? Sort.by(Sort.Direction.ASC, "name") : Sort.by(orders).and(Sort.by(Sort.Direction.ASC, "id"));
        return PageRequest.of(pageable.getPageNumber(), Math.clamp(pageable.getPageSize(), 1, 100), sort);
    }
}

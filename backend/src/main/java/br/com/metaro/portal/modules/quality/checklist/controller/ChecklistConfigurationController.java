package br.com.metaro.portal.modules.quality.checklist.controller;

import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistCatalogType;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistConfigurationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/checklist")
@RequiredArgsConstructor
public class ChecklistConfigurationController {
    private final ChecklistConfigurationService service;

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/header")
    public ChecklistHeaderDto header() {
        return service.header();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/categories/summary")
    public List<ChecklistCategorySummaryDto> categorySummaries() {
        return service.listCategorySummaries();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/categories/model-options")
    public List<ChecklistCategoryModelOptionDto> categoryModelOptions() {
        return service.listCategoryModelOptions();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/categories/{id}")
    public ChecklistCategoryDto getCategory(@PathVariable Long id) {
        return service.getCategory(id);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PatchMapping("/categories/{id}/status")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateCategoryStatus(@PathVariable Long id, @Valid @RequestBody ChecklistCategoryStatusDto dto) {
        service.updateCategoryStatus(id, dto);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/categories/history-settings")
    public List<ChecklistCategoryHistoryDto> categoryHistorySettings() {
        return service.listCategoryHistorySettings();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PatchMapping("/categories/history-settings")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateCategoryHistory(@RequestBody Map<Long, Boolean> settings) {
        service.updateCategoryHistory(settings);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/access/categories")
    public List<ChecklistCategoryAccessDto> categoryAccess() {
        return service.listCategoryAccess();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/templates/summary")
    public List<ChecklistTemplateSummaryDto> templateSummaries() {
        return service.listTemplateSummaries();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/templates/{id}")
    public ChecklistTemplateDto getTemplate(@PathVariable Long id) {
        return service.getTemplate(id);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/categories")
    public ResponseEntity<List<ChecklistCategoryDto>> listCategories() {
        return ResponseEntity.ok(service.listCategories());
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PostMapping("/categories")
    public ResponseEntity<ChecklistCategoryDto> createCategory(@Valid @RequestBody ChecklistCategoryDto dto) {
        dto.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.saveCategory(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/categories/{id}")
    public ResponseEntity<ChecklistCategoryDto> updateCategory(@PathVariable Long id,
                                                                @Valid @RequestBody ChecklistCategoryDto dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.saveCategory(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@PathVariable Long id) {
        service.deleteCategory(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/access")
    public ResponseEntity<Void> updateAccess(@Valid @RequestBody ChecklistAccessUpdateDto dto) {
        service.updateCategoryAccess(dto);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PatchMapping("/access")
    public ResponseEntity<Void> updateAccessBatch(
            @RequestBody @NotEmpty List<@Valid @NotNull ChecklistAccessChangeDto> changes) {
        service.updateCategoryAccessBatch(changes);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @GetMapping("/access/operators")
    public ResponseEntity<List<ChecklistOperatorDto>> listOperators() {
        return ResponseEntity.ok(service.listOperators());
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @GetMapping("/access/me")
    public ResponseEntity<List<Long>> myAccess() {
        return ResponseEntity.ok(service.myCategoryAccess());
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/equipment")
    public ResponseEntity<List<ChecklistEquipmentDto>> listEquipment() {
        return ResponseEntity.ok(service.listEquipment());
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PostMapping("/equipment")
    public ResponseEntity<ChecklistEquipmentDto> createEquipment(@Valid @RequestBody ChecklistEquipmentDto dto) {
        dto.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.saveEquipment(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/equipment/{id}")
    public ResponseEntity<ChecklistEquipmentDto> updateEquipment(@PathVariable Long id,
                                                                  @Valid @RequestBody ChecklistEquipmentDto dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.saveEquipment(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @DeleteMapping("/equipment/{id}")
    public ResponseEntity<Void> deleteEquipment(@PathVariable Long id) {
        service.deleteEquipment(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/templates")
    public ResponseEntity<List<ChecklistTemplateDto>> listTemplates() {
        return ResponseEntity.ok(service.listTemplates());
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PostMapping("/templates")
    public ResponseEntity<ChecklistTemplateDto> createTemplate(@Valid @RequestBody ChecklistTemplateDto dto) {
        dto.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.saveTemplate(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/templates/{id}")
    public ResponseEntity<ChecklistTemplateDto> updateTemplate(@PathVariable Long id,
                                                                @Valid @RequestBody ChecklistTemplateDto dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.saveTemplate(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PostMapping("/templates/{id}/copy")
    public ResponseEntity<ChecklistTemplateDto> copyTemplate(@PathVariable Long id) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.copyTemplate(id));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable Long id) {
        service.deleteTemplate(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/catalog/{type}")
    public ResponseEntity<List<ChecklistCatalogEntryDto>> listCatalog(@PathVariable ChecklistCatalogType type) {
        return ResponseEntity.ok(service.listCatalog(type));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PostMapping("/catalog")
    public ResponseEntity<ChecklistCatalogEntryDto> createCatalogEntry(@Valid @RequestBody ChecklistCatalogEntryDto dto) {
        dto.setId(null);
        return ResponseEntity.status(HttpStatus.CREATED).body(service.saveCatalogEntry(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/catalog/{id}")
    public ResponseEntity<ChecklistCatalogEntryDto> updateCatalogEntry(@PathVariable Long id,
                                                                        @Valid @RequestBody ChecklistCatalogEntryDto dto) {
        dto.setId(id);
        return ResponseEntity.ok(service.saveCatalogEntry(dto));
    }
}

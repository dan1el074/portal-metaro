package br.com.metaro.portal.modules.quality.checklist.controller;

import br.com.metaro.portal.modules.quality.checklist.service.ChecklistDepartmentService;
import lombok.RequiredArgsConstructor;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistDepartmentDto;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/checklist/departments")
@RequiredArgsConstructor
public class ChecklistDepartmentController {
    private final ChecklistDepartmentService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    public List<ChecklistDepartmentDto> list() { return service.list(); }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    public List<ChecklistDepartmentDto> save(@RequestBody List<Long> ids) { return service.save(ids); }
}

package br.com.metaro.portal.modules.quality.checklist.controller;

import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistStepBindingDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistStepRequirementDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistStepEquipmentDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistLinkedStepFlowDto;
import br.com.metaro.portal.core.dto.notification.PendingIssuesDto;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistStepFlowService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/checklist/step-flow")
@RequiredArgsConstructor
public class ChecklistStepFlowController {
    private final ChecklistStepFlowService service;

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW')")
    @GetMapping("/requirements")
    public ResponseEntity<List<ChecklistStepRequirementDto>> listRequirements() {
        return ResponseEntity.ok(service.listRequirements());
    }

    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @PutMapping("/requirements")
    public ResponseEntity<ChecklistStepRequirementDto> saveRequirement(@Valid @RequestBody ChecklistStepRequirementDto dto) {
        return ResponseEntity.ok(service.saveRequirement(dto));
    }

    @PreAuthorize("hasRole('ROLE_ADMIN')")
    @DeleteMapping("/requirements/{stepType}")
    public ResponseEntity<Void> removeRequirement(@PathVariable String stepType) {
        service.removeRequirement(stepType);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_OPERATOR')")
    @PutMapping("/orders/{orderId}/equipment")
    public ResponseEntity<Void> replaceBindings(@PathVariable Long orderId,
                                                 @Valid @RequestBody ChecklistStepBindingDto dto) {
        service.replaceBindings(orderId, dto);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW','ROLE_STEP_FLOW_ADMIN','ROLE_STEP_FLOW_OPERATOR','ROLE_STEP_FLOW_CONSULTATION')")
    @GetMapping("/orders/{orderId}/equipment")
    public ResponseEntity<List<ChecklistStepEquipmentDto>> listEquipment(@PathVariable Long orderId) {
        return ResponseEntity.ok(service.listEquipment(orderId));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/flows/{flowId}/orders")
    public ResponseEntity<List<ChecklistLinkedStepFlowDto>> listLinkedStepFlows(@PathVariable Long flowId) {
        return ResponseEntity.ok(service.listLinkedStepFlows(flowId));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_OPERATOR')")
    @GetMapping("/orders/available-equipment")
    public ResponseEntity<List<ChecklistStepEquipmentDto>> listAvailableEquipment(@RequestParam String orderNumber) {
        return ResponseEntity.ok(service.listAvailableEquipment(orderNumber));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @GetMapping("/alerts")
    public ResponseEntity<List<PendingIssuesDto>> listAlerts() {
        return ResponseEntity.ok(service.listAlerts());
    }
}

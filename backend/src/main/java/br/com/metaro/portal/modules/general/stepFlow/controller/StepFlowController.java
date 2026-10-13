package br.com.metaro.portal.modules.general.stepFlow.controller;

import br.com.metaro.portal.modules.general.stepFlow.dto.OrderDto;
import br.com.metaro.portal.modules.general.stepFlow.dto.OrderInputDto;
import br.com.metaro.portal.modules.general.stepFlow.dto.OrderMinDto;
import br.com.metaro.portal.modules.general.stepFlow.dto.StepFlowInfoDto;
import br.com.metaro.portal.modules.general.stepFlow.service.StepFlowService;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping(value = "/api/step-flow")
public class StepFlowController {
    @Autowired
    private StepFlowService stepFlowService;

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW')")
    @GetMapping
    public ResponseEntity<Page<OrderMinDto>> listOrders(
            Pageable pageable,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String stepFilter
    ) {
        String step = (stepFilter != null && !stepFilter.isBlank()) ? stepFilter : null;
        Page<OrderMinDto> dtos = stepFlowService.listOrders(pageable, search, step);
        return ResponseEntity.ok(dtos);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW')")
    @GetMapping(value = "/{id}")
    public ResponseEntity<OrderDto> findById(@PathVariable Long id) {
        OrderDto dto = stepFlowService.findById(id);
        return ResponseEntity.ok(dto);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_OPERATOR')")
    @GetMapping(value = "/step/{ordinal}")
    public ResponseEntity<List<OrderMinDto>> listOrdersByStep(@PathVariable Integer ordinal) {
        List<OrderMinDto> dtos = stepFlowService.listOrdersByCurrentStep(ordinal);
        return ResponseEntity.ok(dtos);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_CONSULTATION')")
    @GetMapping(value = "/admin")
    public ResponseEntity<StepFlowInfoDto> getStepFlowInfo() {
        StepFlowInfoDto dtos = stepFlowService.generateDashboard();
        return ResponseEntity.ok(dtos);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_OPERATOR')")
    @PostMapping
    public ResponseEntity<Void> create(@RequestBody ErpOrderDto erpOrderDto,
                                       @RequestParam(defaultValue = "false") boolean legacy) {
        stepFlowService.create(erpOrderDto, legacy);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_OPERATOR')")
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<OrderDto> update(
            @PathVariable Long id,
            @ModelAttribute OrderInputDto dto,
            @RequestParam(value = "itemsJson", required = false) String itemsJson,
            @RequestParam(value = "setStage", required = false) String stepId
    ) throws IOException {
        if (stepId != null) dto.setNewStepId(Integer.parseInt(stepId));
        dto.setItems(stepFlowService.parseItems(itemsJson));
        OrderDto newDto = stepFlowService.update(id, dto);
        return ResponseEntity.ok(newDto);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_OPERATOR')")
    @PutMapping(value = "/{id}/nextStep")
    public ResponseEntity<Void> nextStep(@PathVariable Long id) {
        stepFlowService.goToNextStep(id);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_STEP_FLOW_OPERATOR')")
    @DeleteMapping(value = "/image/{id}")
    public ResponseEntity<Void> deleteImageById(@PathVariable Long id) throws IOException {
        stepFlowService.deleteImageById(id);
        return ResponseEntity.noContent().build();
    }
}

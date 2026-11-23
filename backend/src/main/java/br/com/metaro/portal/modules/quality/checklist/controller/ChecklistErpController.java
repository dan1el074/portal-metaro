package br.com.metaro.portal.modules.quality.checklist.controller;

import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.util.erp.ErpOrderQueryService;
import br.com.metaro.portal.util.erp.ErpSource;
import br.com.metaro.portal.util.erp.dto.ErpOrderDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/checklist/erp")
@RequiredArgsConstructor
public class ChecklistErpController {
    private final ErpOrderQueryService erpOrderQueryService;

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @GetMapping("/orders/{orderNumber}")
    public ResponseEntity<ErpOrderDto> findOrder(@PathVariable int orderNumber) {
        return ResponseEntity.ok(erpOrderQueryService.findProductionOrderByNumber(orderNumber, ErpSource.FOCCO)
                .orElseThrow(ResourceNotFoundException::new));
    }
}

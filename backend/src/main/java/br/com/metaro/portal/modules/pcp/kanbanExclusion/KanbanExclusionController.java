package br.com.metaro.portal.modules.pcp.kanbanExclusion;

import br.com.metaro.portal.modules.pcp.kanbanExclusion.dto.KanbanDeleteResultDto;
import br.com.metaro.portal.modules.pcp.kanbanExclusion.dto.KanbanItemDto;
import jakarta.validation.constraints.Positive;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/pcp/kanban-exclusion")
public class KanbanExclusionController {
    private final KanbanExclusionClient client;

    public KanbanExclusionController(KanbanExclusionClient client) {
        this.client = client;
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_KANBAN_EXCLUSION')")
    @GetMapping
    public ResponseEntity<List<KanbanItemDto>> findByLotNumber(
            @RequestParam @Positive Long lotNumber
    ) {
        return ResponseEntity.ok(client.findByLotNumber(lotNumber));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_KANBAN_EXCLUSION')")
    @DeleteMapping("/{orderId}")
    public ResponseEntity<KanbanDeleteResultDto> deleteManufacturingOrder(
            @PathVariable @Positive Long orderId
    ) {
        return ResponseEntity.ok(client.deleteManufacturingOrder(orderId));
    }
}

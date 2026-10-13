package br.com.metaro.portal.core.controller;

import br.com.metaro.portal.core.dto.position.PositionDto;
import br.com.metaro.portal.core.dto.position.PositionFormInputDto;
import br.com.metaro.portal.core.dto.position.PositionMinDto;
import br.com.metaro.portal.core.services.PositionService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(value = "/api/position")
public class PositionController {
    @Autowired
    private PositionService positionService;

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_POSITION_PANEL')")
    @GetMapping
    public ResponseEntity<List<PositionDto>> listPositions() {
        List<PositionDto> dtos = positionService.listPositions();
        return ResponseEntity.ok(dtos);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_ADM_PANEL','ROLE_MEMORANDO','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @GetMapping(value = "/min")
    public ResponseEntity<List<PositionMinDto>> listActivePositions() {
        List<PositionMinDto> dtos = positionService.listActivePositions();
        return ResponseEntity.ok(dtos);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_POSITION_PANEL')")
    @GetMapping(value = "/{id}")
    public ResponseEntity<PositionDto> getPosition(@PathVariable Long id) {
        PositionDto dto = positionService.getPosition(id);
        return ResponseEntity.ok(dto);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_POSITION_PANEL')")
    @PostMapping
    public ResponseEntity<List<PositionDto>> createPosition(@Valid @RequestBody PositionFormInputDto dto) {
        List<PositionDto> dtos = positionService.createPosition(dto);
        return ResponseEntity.ok(dtos);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_POSITION_PANEL')")
    @PutMapping(value = "/{id}")
    public ResponseEntity<List<PositionDto>> updatePosition(@PathVariable Long id, @Valid @RequestBody PositionFormInputDto dto) {
        List<PositionDto> dtos = positionService.updatePosition(id, dto);
        return ResponseEntity.ok(dtos);
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_POSITION_PANEL')")
    @PutMapping(value = "/deactive/{id}")
    public ResponseEntity<List<PositionDto>> deactivatePosition(@PathVariable Long id) {
        List<PositionDto> dtos = positionService.deactivate(id);
        return ResponseEntity.ok(dtos);
    }
}

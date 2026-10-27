package br.com.metaro.portal.modules.pcp.serialplates.controller;

import br.com.metaro.portal.modules.pcp.serialplates.dto.*;
import br.com.metaro.portal.modules.pcp.serialplates.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import java.util.*;

@RestController
@RequestMapping("/api/serial-plates")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR','ROLE_SERIAL_PLATES_CONSULTATION')")
public class SerialPlateController {
    private final SerialPlateService service;
    private final SerialPlateErpService erp;

    @GetMapping
    public Page<SerialPlateDto> listPlates(Pageable pageable, @RequestParam(defaultValue = "") String search, @RequestParam(defaultValue = "") String status) {
        return service.listPlates(pageable, search, status);
    }

    @PostMapping("/relocation-impact")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR')")
    public List<SerialPlateRelocationDto> previewRelocation(@Valid @RequestBody SerialPlateMutationDto dto) {
        return service.previewRelocation(dto);
    }

    @GetMapping("/summary")
    public Map<String, Long> getSummary() { return service.getSummary(); }

    @GetMapping("/{serial}")
    public SerialPlateDto getPlate(@PathVariable Long serial) { return service.getPlate(serial); }

    @GetMapping("/{serial}/history")
    public List<SerialPlateHistoryDto> getHistory(@PathVariable Long serial) { return service.getHistory(serial); }

    @PostMapping("/selection")
    public List<SerialPlateDto> getSelection(@Valid @RequestBody SerialPlateSelectionDto dto) { return service.getSelection(dto.getSerials()); }

    @GetMapping("/range")
    public List<SerialPlateDto> getRange(@RequestParam String anchor, @RequestParam String target, Pageable pageable,
            @RequestParam(defaultValue = "") String search, @RequestParam(defaultValue = "") String status) {
        return service.getRange(anchor, target, pageable, search, status);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR')")
    public List<SerialPlateDto> createPlates(@Valid @RequestBody SerialPlateCreateDto dto) { return service.createPlates(dto); }

    @PutMapping("/{serial}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR')")
    public SerialPlateDto updatePlate(@PathVariable String serial, @Valid @RequestBody SerialPlateMutationDto dto) {
        if (dto.getVersions().size() != 1 || !dto.getVersions().containsKey(serial)) throw new UnprocessableEntityException("Registro inválido.");
        return service.updatePlates(dto).getFirst();
    }

    @PutMapping("/batch")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR')")
    public List<SerialPlateDto> updatePlates(@Valid @RequestBody SerialPlateMutationDto dto) { return service.updatePlates(dto); }

    @GetMapping("/settings")
    public SerialPlateSettingsDto getSettings() { return service.getSettings(); }

    @PutMapping("/settings")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR')")
    public SerialPlateSettingsDto updateSettings(@Valid @RequestBody SerialPlateSettingsDto dto) { return service.updateSettings(dto); }

    @GetMapping("/erp/orders/{number}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR')")
    public SerialPlateOrderDto findOrder(@PathVariable String number) { return erp.findOrder(number); }

    @PostMapping("/report")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SERIAL_PLATES_OPERATOR')")
    public SerialPlateReportDto prepareReport(@Valid @RequestBody SerialPlateSelectionDto dto) { return service.prepareReport(dto); }
}

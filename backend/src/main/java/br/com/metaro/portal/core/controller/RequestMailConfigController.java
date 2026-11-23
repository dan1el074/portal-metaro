package br.com.metaro.portal.core.controller;

import br.com.metaro.portal.core.dto.request.RequestMailConfigDto;
import br.com.metaro.portal.core.dto.request.RequestMailConfigUpdateDto;
import br.com.metaro.portal.core.services.RequestMailConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/request-access/config")
@RequiredArgsConstructor
public class RequestMailConfigController {
    private final RequestMailConfigService configService;

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SYSTEM_PARAMS')")
    @GetMapping
    public ResponseEntity<RequestMailConfigDto> getConfig() {
        return ResponseEntity.ok(configService.getConfig());
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_SYSTEM_PARAMS')")
    @PutMapping
    public ResponseEntity<RequestMailConfigDto> updateConfig(@Valid @RequestBody RequestMailConfigUpdateDto dto) {
        return ResponseEntity.ok(configService.updateConfig(dto));
    }
}

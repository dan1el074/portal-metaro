package br.com.metaro.portal.modules.quality.checklist.controller;

import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistEvidenceDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistVideoCreateDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistVideoUploadDto;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistEvidenceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/checklist/records/{recordId}/evidence")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
public class ChecklistEvidenceController {
    private final ChecklistEvidenceService service;

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<List<ChecklistEvidenceDto>> uploadImages(@PathVariable Long recordId,
                                                                    @RequestParam String problemId,
                                                                    @RequestParam MultipartFile[] images) throws IOException {
        return ResponseEntity.ok(service.uploadImages(recordId, problemId, images));
    }

    @PostMapping("/videos")
    public ResponseEntity<ChecklistVideoUploadDto> createVideo(@PathVariable Long recordId,
                                                                @Valid @RequestBody ChecklistVideoCreateDto dto) {
        return ResponseEntity.ok(service.createVideo(recordId, dto));
    }

    @PutMapping("/{evidenceId}/complete")
    public ResponseEntity<ChecklistEvidenceDto> completeVideo(@PathVariable Long recordId,
                                                               @PathVariable Long evidenceId) {
        return ResponseEntity.ok(service.completeVideo(recordId, evidenceId));
    }

    @DeleteMapping("/{evidenceId}")
    public ResponseEntity<Void> delete(@PathVariable Long recordId, @PathVariable Long evidenceId) throws IOException {
        service.delete(recordId, evidenceId);
        return ResponseEntity.noContent().build();
    }
}

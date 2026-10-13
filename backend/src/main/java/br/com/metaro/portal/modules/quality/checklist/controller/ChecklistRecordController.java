package br.com.metaro.portal.modules.quality.checklist.controller;

import br.com.metaro.portal.modules.quality.checklist.dto.*;
import br.com.metaro.portal.modules.quality.checklist.service.ChecklistRecordService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/checklist/records")
@RequiredArgsConstructor
public class ChecklistRecordController {
    private final ChecklistRecordService service;

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping
    public ResponseEntity<Page<ChecklistRecordDto>> listRecords(Pageable pageable) {
        return ResponseEntity.ok(service.listRecords(pageable));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/flows")
    public ResponseEntity<List<ChecklistFlowDto>> listFlows() {
        return ResponseEntity.ok(service.listVisibleFlows());
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/{id}")
    public ResponseEntity<ChecklistRecordDto> getRecord(@PathVariable Long id) {
        return ResponseEntity.ok(service.getRecord(id));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/{id}/flow")
    public ResponseEntity<ChecklistFlowDto> getFlow(@PathVariable Long id) {
        ChecklistRecordDto record = service.getRecord(id);
        return ResponseEntity.ok(service.getFlow(record.getFlowId()));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR','ROLE_CHECKLIST_CONSULTATION')")
    @GetMapping("/client/{clientId}/problems")
    public ResponseEntity<List<ChecklistRecordDto>> getClientHistory(@PathVariable String clientId) {
        return ResponseEntity.ok(service.getClientHistory(clientId));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PostMapping
    public ResponseEntity<ChecklistRecordDto> createRecord(@Valid @RequestBody ChecklistRecordCreateDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createRecord(dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PutMapping("/{id}")
    public ResponseEntity<ChecklistRecordDto> saveRecord(@PathVariable Long id,
                                                          @RequestBody ChecklistRecordDto dto) {
        return ResponseEntity.ok(service.saveRecord(id, dto, false));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PutMapping("/{id}/finish")
    public ResponseEntity<ChecklistRecordDto> finishRecord(@PathVariable Long id,
                                                            @RequestBody ChecklistRecordDto dto) {
        return ResponseEntity.ok(service.saveRecord(id, dto, true));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PutMapping("/{id}/claim")
    public ResponseEntity<ChecklistRecordDto> claimRecord(@PathVariable Long id) {
        return ResponseEntity.ok(service.claimRecord(id));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PutMapping("/{id}/treatment")
    public ResponseEntity<ChecklistRecordDto> treatProblem(@PathVariable Long id,
                                                            @Valid @RequestBody ChecklistTreatmentDto dto) {
        return ResponseEntity.ok(service.treatProblem(id, dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/{id}/reopen")
    public ResponseEntity<ChecklistRecordDto> reopenRecord(@PathVariable Long id,
                                                            @Valid @RequestBody ChecklistReasonDto dto) {
        return ResponseEntity.ok(service.reopenRecord(id, dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/{id}/cancel")
    public ResponseEntity<Void> cancelFlow(@PathVariable Long id, @Valid @RequestBody ChecklistReasonDto dto) {
        service.cancelFlow(id, dto);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/{id}/delegate/{userId}")
    public ResponseEntity<ChecklistRecordDto> delegate(@PathVariable Long id, @PathVariable Long userId) {
        return ResponseEntity.ok(service.delegate(id, userId));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/{id}/order")
    public ResponseEntity<ChecklistFlowDto> updateOrder(@PathVariable Long id,
                                                         @Valid @RequestBody ChecklistOrderUpdateDto dto) {
        return ResponseEntity.ok(service.updateOrder(id, dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN')")
    @PutMapping("/{id}/serial")
    public ResponseEntity<ChecklistFlowDto> updateSerial(@PathVariable Long id,
                                                          @Valid @RequestBody ChecklistSerialUpdateDto dto) {
        return ResponseEntity.ok(service.updateSerial(id, dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PostMapping("/{id}/comments")
    public ResponseEntity<ChecklistCommentDto> addComment(@PathVariable Long id,
                                                           @Valid @RequestBody ChecklistCommentInputDto dto) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addComment(id, dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @PutMapping("/{recordId}/comments/{commentId}")
    public ResponseEntity<ChecklistCommentDto> updateComment(@PathVariable Long recordId,
                                                              @PathVariable Long commentId,
                                                              @Valid @RequestBody ChecklistCommentInputDto dto) {
        return ResponseEntity.ok(service.updateComment(recordId, commentId, dto));
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @DeleteMapping("/{recordId}/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long recordId, @PathVariable Long commentId) {
        service.deleteComment(recordId, commentId);
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CHECKLIST_ADMIN','ROLE_CHECKLIST_OPERATOR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDraft(@PathVariable Long id) throws java.io.IOException {
        service.deleteDraft(id);
        return ResponseEntity.noContent().build();
    }
}

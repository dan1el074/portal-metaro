package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.entities.User;
import br.com.metaro.portal.core.services.UserService;
import br.com.metaro.portal.core.services.exceptions.ForbiddenException;
import br.com.metaro.portal.core.services.exceptions.ResourceNotFoundException;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistEvidenceDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistVideoCreateDto;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistVideoUploadDto;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistEvidence;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistRecord;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStatus;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistEvidenceRepository;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistRecordRepository;
import br.com.metaro.portal.util.picture.Picture;
import br.com.metaro.portal.util.picture.PictureService;
import br.com.metaro.portal.util.video.Video;
import br.com.metaro.portal.util.video.VideoService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ChecklistEvidenceService {
    private final ChecklistEvidenceRepository evidenceRepository;
    private final ChecklistRecordRepository recordRepository;
    private final br.com.metaro.portal.modules.quality.checklist.repository.ChecklistRevisionRepository revisionRepository;
    private final PictureService pictureService;
    private final VideoService videoService;
    private final UserService userService;

    @Transactional
    public List<ChecklistEvidenceDto> uploadImages(Long recordId, String problemId, MultipartFile[] images) throws IOException {
        ChecklistRecord record = editableRecord(recordId);
        if (problemId == null || problemId.isBlank()) throw new UnprocessableEntityException("É necessário informar o ID do problema.");
        if (images == null || images.length == 0) throw new UnprocessableEntityException("É necessário informar pelo menos uma imagem.");
        User user = userService.authenticate();
        List<Picture> pictures = pictureService.saveChecklistImages(List.of(images));
        List<ChecklistEvidenceDto> result = new ArrayList<>();
        for (int index = 0; index < pictures.size(); index++) {
            MultipartFile file = images[index];
            ChecklistEvidence evidence = baseEvidence(record, problemId, file.getOriginalFilename(), file.getContentType(), file.getSize(), user);
            evidence.setPicture(pictures.get(index));
            result.add(toDto(evidenceRepository.save(evidence)));
        }
        return result;
    }

    @Transactional
    public ChecklistVideoUploadDto createVideo(Long recordId, ChecklistVideoCreateDto input) {
        ChecklistRecord record = editableRecord(recordId);
        User user = userService.authenticate();
        Video video = videoService.createPendingVideo("EVIDENCIA_" + input.getName().trim());
        ChecklistEvidence evidence = baseEvidence(record, input.getProblemId(), input.getName().trim(), "video/*", 0, user);
        evidence.setVideo(video);
        evidenceRepository.save(evidence);
        ChecklistVideoUploadDto result = new ChecklistVideoUploadDto();
        result.setEvidence(toDto(evidence));
        result.setUpload(videoService.createUploadInstructions(video));
        return result;
    }

    @Transactional
    public ChecklistEvidenceDto completeVideo(Long recordId, Long evidenceId) {
        editableRecord(recordId);
        ChecklistEvidence evidence = find(recordId, evidenceId);
        if (evidence.getVideo() == null) throw new UnprocessableEntityException("A evidência não é um vídeo.");
        videoService.markAsReady(evidence.getVideo());
        return toDto(evidence);
    }

    @Transactional
    public void delete(Long recordId, Long evidenceId) throws IOException {
        editableRecord(recordId);
        ChecklistEvidence evidence = find(recordId, evidenceId);
        evidenceRepository.delete(evidence);
        evidenceRepository.flush();
        if (!revisionRepository.existsByRecordId(recordId)) deleteMedia(evidence);
    }

    @Transactional
    public void deleteAll(Long recordId) throws IOException {
        for (ChecklistEvidence evidence : evidenceRepository.findByRecordIdOrderByCreatedAtAsc(recordId)) {
            evidenceRepository.delete(evidence);
            evidenceRepository.flush();
            deleteMedia(evidence);
        }
    }

    @Transactional(readOnly = true)
    public List<ChecklistEvidence> findByRecord(Long recordId) {
        return evidenceRepository.findByRecordIdOrderByCreatedAtAsc(recordId);
    }

    public ChecklistEvidenceDto toDto(ChecklistEvidence evidence) {
        ChecklistEvidenceDto dto = new ChecklistEvidenceDto();
        dto.setId(evidence.getId().toString());
        dto.setName(evidence.getOriginalName());
        dto.setType(evidence.getContentType());
        dto.setSize(evidence.getSize());
        if (evidence.getPicture() != null) dto.setPublicUrl("/images/" + evidence.getPicture().getId());
        if (evidence.getVideo() != null) {
            dto.setPublicUrl(evidence.getVideo().getPlaybackUrl());
            dto.setPreviewUrl(videoService.getPreviewUrl(evidence.getVideo(), true));
        }
        return dto;
    }

    private ChecklistEvidence baseEvidence(ChecklistRecord record, String problemId, String name, String contentType,
                                             long size, User user) {
        ChecklistEvidence evidence = new ChecklistEvidence();
        evidence.setRecord(record);
        evidence.setProblemId(problemId.trim());
        evidence.setOriginalName(name == null || name.isBlank() ? "evidence" : name);
        evidence.setContentType(contentType == null || contentType.isBlank() ? "application/octet-stream" : contentType);
        evidence.setSize(size);
        evidence.setCreatedBy(user);
        evidence.setCreatedAt(Instant.now());
        return evidence;
    }

    private ChecklistRecord editableRecord(Long recordId) {
        User user = userService.authenticate();
        ChecklistRecord record = recordRepository.findById(recordId).orElseThrow(ResourceNotFoundException::new);
        if (record.getStatus() != ChecklistStatus.DRAFT && record.getStatus() != ChecklistStatus.IN_PROGRESS) {
            throw new UnprocessableEntityException("A evidência só pode ser alterada durante o preenchimento do checklist.");
        }
        boolean administrator = user.getAuthorities().stream().anyMatch(authority ->
                authority.getAuthority().equals("ROLE_ADMIN") || authority.getAuthority().equals("ROLE_CHECKLIST_ADMIN"));
        if (!administrator && record.getOwner() != null && !record.getOwner().getId().equals(user.getId())) {
            throw new ForbiddenException("O checklist pertence a outro operador.");
        }
        return record;
    }

    private ChecklistEvidence find(Long recordId, Long evidenceId) {
        return evidenceRepository.findByIdAndRecordId(evidenceId, recordId).orElseThrow(ResourceNotFoundException::new);
    }

    private void deleteMedia(ChecklistEvidence evidence) throws IOException {
        if (evidence.getPicture() != null) pictureService.delete(evidence.getPicture().getId());
        if (evidence.getVideo() != null) videoService.delete(evidence.getVideo());
    }
}

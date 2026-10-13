package br.com.metaro.portal.modules.quality.checklist.dto;

import br.com.metaro.portal.util.video.dto.VideoUploadDto;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistVideoUploadDto {
    private ChecklistEvidenceDto evidence;
    private VideoUploadDto upload;
}

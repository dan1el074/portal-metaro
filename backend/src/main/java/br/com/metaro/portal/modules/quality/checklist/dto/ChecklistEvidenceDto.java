package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistEvidenceDto {
    private String id;
    private String name;
    private String type;
    private long size;
    private String publicUrl;
    private String previewUrl;
}

package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
public class ChecklistCommentDto {
    private Long id;
    private Long authorId;
    private String author;
    private Instant at;
    private String text;
    private String problemId;
}

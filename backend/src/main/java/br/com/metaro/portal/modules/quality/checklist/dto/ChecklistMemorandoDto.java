package br.com.metaro.portal.modules.quality.checklist.dto;

import br.com.metaro.portal.modules.general.memorando.entity.MemorandoStatus;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistMemorandoDto {
    private Long id;
    private Long number;
    private String title;
    private Instant createAt;
    private MemorandoStatus status;
}

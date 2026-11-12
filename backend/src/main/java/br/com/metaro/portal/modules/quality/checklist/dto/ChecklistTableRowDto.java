package br.com.metaro.portal.modules.quality.checklist.dto;

import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ChecklistTableRowDto {
    private String id;
    private Long number;
    private String title;
    private String category;
    private String categoryId;
    private String model;
    private String equipment;
    private String equipmentId;
    private String serial;
    private String order;
    private String status;
    private Instant updated;
}

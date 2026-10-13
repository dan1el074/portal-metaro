package br.com.metaro.portal.modules.quality.checklist.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Getter
@Setter
@NoArgsConstructor
public class ChecklistRecordCreateDto {
    @NotNull
    private Long templateId;
    private Long predecessorRecordId;
    private String serial;
    private String order;
    private String clientId;
    private String client;
    private String item;
    private String seller;
}

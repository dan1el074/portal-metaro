package br.com.metaro.portal.modules.quality.checklist.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ChecklistHeaderCountDto {
    private final long categories;
    private final long models;
    private final long equipment;
}

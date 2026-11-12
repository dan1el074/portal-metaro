package br.com.metaro.portal.modules.quality.checklist.service;

import br.com.metaro.portal.core.repositories.PositionRepository;
import br.com.metaro.portal.modules.quality.checklist.dto.ChecklistDepartmentDto;
import br.com.metaro.portal.core.services.exceptions.UnprocessableEntityException;
import com.fasterxml.jackson.core.type.TypeReference;
import lombok.RequiredArgsConstructor;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistSettings;
import br.com.metaro.portal.modules.quality.checklist.repository.ChecklistSettingsRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ChecklistDepartmentService {
    private final PositionRepository positions;
    private final ChecklistSettingsRepository settings;
    private final ChecklistMapper mapper;

    @Transactional(readOnly = true)
    public List<ChecklistDepartmentDto> list() {
        String json = settings.findById(1).map(ChecklistSettings::getDepartmentIdsJson).orElse(null);
        List<Long> selected = json == null ? null : mapper.read(json, new TypeReference<>() {});
        return positions.findAll().stream().filter(p -> Boolean.TRUE.equals(p.getActivated()))
                .map(p -> new ChecklistDepartmentDto(p.getId(), p.getName(), selected == null || selected.contains(p.getId())))
                .sorted(Comparator.comparing(ChecklistDepartmentDto::getName, String.CASE_INSENSITIVE_ORDER)).toList();
    }

    @Transactional
    public List<ChecklistDepartmentDto> save(List<Long> ids) {
        if (ids == null || ids.stream().anyMatch(Objects::isNull)) throw new UnprocessableEntityException("Selecione os setores válidos.");
        Set<Long> active = new HashSet<>();
        positions.findAll().stream().filter(p -> Boolean.TRUE.equals(p.getActivated())).forEach(p -> active.add(p.getId()));
        if (!active.containsAll(ids)) throw new UnprocessableEntityException("Um dos setores selecionados está indisponível. Atualize as configurações.");
        ChecklistSettings value = settings.findById(1).orElseGet(() -> { var initial = new ChecklistSettings(); initial.setId(1); return initial; });
        value.setDepartmentIdsJson(mapper.write(ids.stream().distinct().sorted().toList()));
        settings.save(value);
        return list();
    }
}

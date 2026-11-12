package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChecklistSettingsRepository extends JpaRepository<ChecklistSettings, Integer> {}

package br.com.metaro.portal.modules.quality.checklist.repository;

import br.com.metaro.portal.modules.general.stepFlow.entities.StepType;
import br.com.metaro.portal.modules.quality.checklist.entity.ChecklistStepRequirement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChecklistStepRequirementRepository extends JpaRepository<ChecklistStepRequirement, Long> {
    Optional<ChecklistStepRequirement> findByStepType(StepType stepType);
    void deleteByStepType(StepType stepType);
    boolean existsByCategoryId(Long categoryId);
}

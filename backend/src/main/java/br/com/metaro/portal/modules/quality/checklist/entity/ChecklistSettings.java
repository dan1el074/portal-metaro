package br.com.metaro.portal.modules.quality.checklist.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "tb_checklist_settings")
@Getter
@Setter
public class ChecklistSettings {
    @Id
    private Integer id;
    @Column(columnDefinition = "TEXT")
    private String departmentIdsJson;
}

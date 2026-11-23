package br.com.metaro.portal.modules.quality.checklist.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "tb_checklist_equipment")
@Getter
@Setter
@NoArgsConstructor
public class ChecklistEquipment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String abbreviation;
    private String name;
    private Instant createdAt;
    private Instant updatedAt;
}

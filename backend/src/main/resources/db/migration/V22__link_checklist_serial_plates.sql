ALTER TABLE tb_checklist_flow ADD COLUMN lock_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tb_checklist_flow ADD COLUMN serial_plate_id BIGINT;
ALTER TABLE tb_checklist_flow ADD COLUMN ready_stock BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tb_checklist_flow ADD COLUMN serial_waived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tb_checklist_flow ADD COLUMN erp_data_json TEXT NOT NULL DEFAULT '{}';

-- Preserve legacy identification; associate only unambiguous active matches.
UPDATE tb_checklist_flow
SET serial_plate_id = (SELECT p.serial FROM tb_serial_plate p
    WHERE CAST(p.serial AS VARCHAR(120)) = tb_checklist_flow.normalized_serial)
WHERE cancelled = FALSE AND normalized_serial IS NOT NULL;

ALTER TABLE tb_checklist_flow ADD CONSTRAINT fk_checklist_flow_serial_plate
    FOREIGN KEY (serial_plate_id) REFERENCES tb_serial_plate(serial);
ALTER TABLE tb_checklist_flow ADD CONSTRAINT uk_checklist_flow_serial_plate UNIQUE (serial_plate_id);

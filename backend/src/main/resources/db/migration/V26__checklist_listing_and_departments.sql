ALTER TABLE tb_checklist_record ADD COLUMN listing_title TEXT;

CREATE TABLE tb_checklist_settings (
    id INTEGER PRIMARY KEY,
    department_ids_json TEXT
);

-- NULL preserves the initial behavior: all active departments are available.
INSERT INTO tb_checklist_settings (id, department_ids_json) VALUES (1, NULL);

CREATE INDEX idx_checklist_record_category_sort
    ON tb_checklist_record (template_id, updated_at DESC, id DESC);

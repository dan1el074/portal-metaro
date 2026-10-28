ALTER TABLE tb_checklist_category
ADD COLUMN media_enabled BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tb_checklist_category
SET media_enabled = TRUE
WHERE integration = 'PRODUCTION';

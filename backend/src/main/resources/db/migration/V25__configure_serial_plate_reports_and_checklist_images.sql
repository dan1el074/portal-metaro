INSERT INTO tb_param(name, content)
VALUES ('serialPlates.reportColumns', 'serial,description,manufactured,voltage,crea,weight');

-- Older production schemas retain Hibernate's check constraint for PictureType.
-- Keep existing picture types and allow images uploaded as checklist evidence.
ALTER TABLE tb_picture DROP CONSTRAINT IF EXISTS tb_picture_type_check;
ALTER TABLE tb_picture ADD CONSTRAINT tb_picture_type_check
    CHECK (type IN ('EVENT', 'POST', 'PROFILE', 'STEP_FLOW', 'CHECKLIST'));

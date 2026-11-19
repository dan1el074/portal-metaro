-- PostgreSQL. Execução manual, com a aplicação parada e backup conferido.
-- Remove os dados dos módulos. Execute antes de 02_carregar_checklist_plaquetas.sql.
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE tb_checklist_flow, tb_checklist_record, tb_serial_plate, tb_param IN ACCESS EXCLUSIVE MODE;

-- Preserva o contador e o eleva ao maior número de série existente, se necessário.
DO $counter$
BEGIN
    IF (SELECT count(*) FROM tb_param WHERE name = 'serialPlatesCount') > 1
       OR EXISTS (SELECT 1 FROM tb_param WHERE name = 'serialPlatesCount'
                  AND (content IS NULL OR content !~ '^[0-9]+$')) THEN
        RAISE EXCEPTION 'Contador de séries inválido ou duplicado. Corrija antes da limpeza.';
    END IF;
END;
$counter$;

UPDATE tb_param SET content = GREATEST(content::bigint,
    (SELECT COALESCE(max(serial), 18917) FROM tb_serial_plate))::text
WHERE name = 'serialPlatesCount';

INSERT INTO tb_param (name, content)
SELECT 'serialPlatesCount', GREATEST(COALESCE(max(serial), 18917), 18917)::text
FROM tb_serial_plate
HAVING NOT EXISTS (SELECT 1 FROM tb_param WHERE name = 'serialPlatesCount');

CREATE TEMP TABLE checklist_media_to_delete ON COMMIT DROP AS
SELECT video_id FROM tb_checklist_evidence WHERE video_id IS NOT NULL;

UPDATE tb_stepflow_order_step SET checklist_pending = FALSE WHERE checklist_pending;

-- Dependências imprevistas abortam a transação. Não usar CASCADE.
TRUNCATE TABLE
    tb_checklist_step_binding_history, tb_checklist_step_binding,
    tb_checklist_step_requirement, tb_checklist_evidence, tb_checklist_audit,
    tb_checklist_comment, tb_checklist_revision, tb_checklist_record,
    tb_checklist_flow, tb_checklist_template, tb_checklist_category_access,
    tb_checklist_category, tb_checklist_equipment, tb_checklist_catalog_entry,
    tb_checklist_settings, tb_serial_plate_log, tb_serial_plate
RESTART IDENTITY;

-- Remoção no banco. Arquivos físicos e vídeos do provedor externo ficam fora do SQL.
DELETE FROM tb_picture p
WHERE p.type = 'CHECKLIST' AND p.post_id IS NULL AND p.step_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM tb_user u WHERE u.picture_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM tb_event e WHERE e.picture_id = p.id);

DELETE FROM tb_video v
WHERE v.order_step_id IS NULL
  AND EXISTS (SELECT 1 FROM checklist_media_to_delete m WHERE m.video_id = v.id);

DELETE FROM tb_param WHERE name IN (
    'serialPlates.crea', 'serialPlates.instructions',
    'serialPlates.providers', 'serialPlates.reportColumns');

COMMIT;

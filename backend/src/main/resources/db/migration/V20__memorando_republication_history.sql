ALTER TABLE tb_memorando ADD COLUMN published_snapshot_json TEXT;
ALTER TABLE tb_memorando_log ALTER COLUMN content TYPE TEXT;

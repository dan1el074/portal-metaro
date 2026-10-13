ALTER TABLE tb_stepflow_order ADD COLUMN volumes INTEGER;
ALTER TABLE tb_stepflow_order ADD COLUMN length NUMERIC(12, 2);
ALTER TABLE tb_stepflow_order ADD COLUMN width NUMERIC(12, 2);
ALTER TABLE tb_stepflow_order ADD COLUMN height NUMERIC(12, 2);
ALTER TABLE tb_stepflow_order ADD COLUMN weight NUMERIC(12, 2);

ALTER TABLE tb_stepflow_order ADD CONSTRAINT ck_stepflow_order_volumes_non_negative CHECK (volumes IS NULL OR volumes >= 0);
ALTER TABLE tb_stepflow_order ADD CONSTRAINT ck_stepflow_order_length_non_negative CHECK (length IS NULL OR length >= 0);
ALTER TABLE tb_stepflow_order ADD CONSTRAINT ck_stepflow_order_width_non_negative CHECK (width IS NULL OR width >= 0);
ALTER TABLE tb_stepflow_order ADD CONSTRAINT ck_stepflow_order_height_non_negative CHECK (height IS NULL OR height >= 0);
ALTER TABLE tb_stepflow_order ADD CONSTRAINT ck_stepflow_order_weight_non_negative CHECK (weight IS NULL OR weight >= 0);

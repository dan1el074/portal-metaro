CREATE TABLE tb_stepflow_order_volume (
    id BIGSERIAL PRIMARY KEY,
    quantity INTEGER NOT NULL DEFAULT 1,
    length NUMERIC(12, 2) NOT NULL,
    width NUMERIC(12, 2) NOT NULL,
    height NUMERIC(12, 2) NOT NULL,
    weight NUMERIC(12, 2) NOT NULL,
    order_id BIGINT NOT NULL,
    CONSTRAINT fk_stepflow_order_volume_order
        FOREIGN KEY (order_id) REFERENCES tb_stepflow_order(id) ON DELETE CASCADE,
    CONSTRAINT ck_stepflow_order_volume_quantity_positive CHECK (quantity > 0),
    CONSTRAINT ck_stepflow_order_volume_length_non_negative CHECK (length >= 0),
    CONSTRAINT ck_stepflow_order_volume_width_non_negative CHECK (width >= 0),
    CONSTRAINT ck_stepflow_order_volume_height_non_negative CHECK (height >= 0),
    CONSTRAINT ck_stepflow_order_volume_weight_non_negative CHECK (weight >= 0)
);

CREATE INDEX idx_stepflow_order_volume_order_id ON tb_stepflow_order_volume(order_id);

INSERT INTO tb_stepflow_order_volume (quantity, length, width, height, weight, order_id)
SELECT volumes, length, width, height, weight, id
FROM tb_stepflow_order
WHERE volumes IS NOT NULL
  AND volumes > 0
  AND length IS NOT NULL
  AND width IS NOT NULL
  AND height IS NOT NULL
  AND weight IS NOT NULL;

ALTER TABLE tb_stepflow_order DROP CONSTRAINT IF EXISTS ck_stepflow_order_volumes_non_negative;
ALTER TABLE tb_stepflow_order DROP CONSTRAINT IF EXISTS ck_stepflow_order_length_non_negative;
ALTER TABLE tb_stepflow_order DROP CONSTRAINT IF EXISTS ck_stepflow_order_width_non_negative;
ALTER TABLE tb_stepflow_order DROP CONSTRAINT IF EXISTS ck_stepflow_order_height_non_negative;
ALTER TABLE tb_stepflow_order DROP CONSTRAINT IF EXISTS ck_stepflow_order_weight_non_negative;

ALTER TABLE tb_stepflow_order DROP COLUMN volumes;
ALTER TABLE tb_stepflow_order DROP COLUMN length;
ALTER TABLE tb_stepflow_order DROP COLUMN width;
ALTER TABLE tb_stepflow_order DROP COLUMN height;
ALTER TABLE tb_stepflow_order DROP COLUMN weight;

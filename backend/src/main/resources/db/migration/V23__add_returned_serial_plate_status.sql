-- Retain retired status values on existing plates without rewriting their history.
-- The service rejects assigning Terceiro to any other plate.
ALTER TABLE tb_serial_plate DROP CONSTRAINT ck_serial_plate_status;
ALTER TABLE tb_serial_plate ADD CONSTRAINT ck_serial_plate_status
    CHECK (status IN ('Criado','Programado','Recebido','Devolvido','Finalizado','Terceiro'));

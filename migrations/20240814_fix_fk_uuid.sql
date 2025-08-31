BEGIN;

-- Habilita função pra gerar UUID, se ainda não tiver
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Deixa affiliates.id como UUID (ele já tem valores no formato UUID, só muda o tipo)
ALTER TABLE affiliates
  ALTER COLUMN id TYPE uuid USING id::uuid,
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Garante que sales.affiliate_id também é UUID
ALTER TABLE sales
  ALTER COLUMN affiliate_id TYPE uuid USING affiliate_id::uuid;

-- Recria a FK com os tipos corretos
ALTER TABLE sales DROP CONSTRAINT IF EXISTS fk_sales_affiliate;

ALTER TABLE sales
  ADD CONSTRAINT fk_sales_affiliate
  FOREIGN KEY (affiliate_id) REFERENCES affiliates(id)
  ON DELETE RESTRICT;

COMMIT;

-- Add codigo field to academias for self-service signup

ALTER TABLE academias ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) UNIQUE;

-- Generate codes for existing academias (if any don't have one)
UPDATE academias 
SET codigo = UPPER(SUBSTRING(REPLACE(nome, ' ', ''), 1, 4) || SUBSTRING(id::text, 1, 4))
WHERE codigo IS NULL;

COMMENT ON COLUMN academias.codigo IS 'Código público da academia para cadastro self-service, ex: ACADBJJ1';

-- Index for lookup by codigo
CREATE INDEX IF NOT EXISTS idx_academias_codigo ON academias(codigo);

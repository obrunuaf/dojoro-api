-- Add profile fields to usuarios table for complete profile feature

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;

COMMENT ON COLUMN usuarios.telefone IS 'Telefone com código do país, ex: +5511999999999';
COMMENT ON COLUMN usuarios.data_nascimento IS 'Data de nascimento para cálculo de idade e validações';

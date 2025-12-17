-- Add additional fields to academias table for settings feature

ALTER TABLE academias ADD COLUMN IF NOT EXISTS endereco TEXT;
ALTER TABLE academias ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);
ALTER TABLE academias ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE academias ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN academias.endereco IS 'Endereço completo da academia';
COMMENT ON COLUMN academias.telefone IS 'Telefone de contato com código do país';
COMMENT ON COLUMN academias.email IS 'Email de contato da academia';
COMMENT ON COLUMN academias.logo_url IS 'URL da logo da academia (Supabase Storage ou CDN)';

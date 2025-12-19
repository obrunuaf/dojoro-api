-- Migration: Add profile completion tracking and missing fields
-- Date: 2024-12-19

-- Add perfil_completo column to track if user completed their profile
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS perfil_completo BOOLEAN DEFAULT FALSE;

-- Add faixa_declarada column (self-declared belt, pending confirmation)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS faixa_declarada VARCHAR(20);

-- Ensure data_nascimento exists (should already exist but just in case)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS data_nascimento DATE;

-- Ensure telefone exists
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone VARCHAR(20);

-- Add sexo column
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS sexo CHAR(1);

-- Add foto_url column for profile pictures
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500);

-- Add atualizado_em column for audit tracking
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();

-- Add status_matricula column
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_matricula_enum') THEN
    CREATE TYPE status_matricula_enum AS ENUM ('INCOMPLETO', 'PENDENTE', 'ATIVO', 'REJEITADO', 'SUSPENSO');
  END IF;
END $$;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS status_matricula status_matricula_enum DEFAULT 'INCOMPLETO';

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_completo ON usuarios(perfil_completo);
CREATE INDEX IF NOT EXISTS idx_usuarios_status_matricula ON usuarios(status_matricula);

-- Update existing users to ATIVO if they were previously active (backward compatibility)
-- This assumes existing users were valid before this migration
UPDATE usuarios 
SET status_matricula = 'ATIVO', perfil_completo = TRUE 
WHERE status = 'ativo' AND perfil_completo IS NULL;

-- Set INCOMPLETO for users without profile data
UPDATE usuarios 
SET status_matricula = 'INCOMPLETO', perfil_completo = FALSE 
WHERE (data_nascimento IS NULL OR telefone IS NULL) AND perfil_completo IS NULL;

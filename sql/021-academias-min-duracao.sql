-- Adiciona configuração de duração mínima de aula por academia
-- Default: 30 minutos (admin pode alterar em tela futura)

ALTER TABLE academias 
ADD COLUMN IF NOT EXISTS min_duracao_aula_minutos integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN academias.min_duracao_aula_minutos IS 'Duração mínima de uma aula em minutos';

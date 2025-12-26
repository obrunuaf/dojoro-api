-- Migration: Refatorar turmas para usar hora_inicio + hora_fim
-- Alinha estrutura com aulas (data_inicio, data_fim)

-- 1. Renomear horario_padrao -> hora_inicio
ALTER TABLE turmas 
  RENAME COLUMN horario_padrao TO hora_inicio;

-- 2. Adicionar hora_fim com default temporário
ALTER TABLE turmas 
  ADD COLUMN hora_fim time NOT NULL DEFAULT '19:00';

-- 3. Popular hora_fim baseado em duração padrão de 60min
UPDATE turmas SET hora_fim = hora_inicio + interval '60 minutes';

-- 4. Remover default (agora é obrigatório informar)
ALTER TABLE turmas ALTER COLUMN hora_fim DROP DEFAULT;

-- 5. Comentários
COMMENT ON COLUMN turmas.hora_inicio IS 'Horário de início da aula (HH:MM)';
COMMENT ON COLUMN turmas.hora_fim IS 'Horário de término da aula (HH:MM)';

-- 6. Constraint para garantir hora_fim > hora_inicio
ALTER TABLE turmas 
  ADD CONSTRAINT turmas_hora_fim_after_inicio 
  CHECK (hora_fim > hora_inicio);

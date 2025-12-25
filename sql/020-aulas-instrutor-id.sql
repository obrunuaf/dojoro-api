-- ========================================
-- Migration 020: Adiciona instrutor_id em aulas
-- Permite associar um instrutor específico a cada aula
-- (antes só havia instrutor_padrao_id na turma)
-- ========================================

-- 1) Adiciona a coluna instrutor_id na tabela aulas
ALTER TABLE aulas 
ADD COLUMN IF NOT EXISTS instrutor_id UUID REFERENCES usuarios(id);

-- 2) Índice para consultas por instrutor
CREATE INDEX IF NOT EXISTS idx_aulas_instrutor_id ON aulas(instrutor_id);

-- 3) Preencher instrutor_id com o instrutor_padrao_id da turma (para aulas existentes)
UPDATE aulas a
SET instrutor_id = t.instrutor_padrao_id
FROM turmas t
WHERE a.turma_id = t.id
  AND a.instrutor_id IS NULL
  AND t.instrutor_padrao_id IS NOT NULL;

-- 4) Comentário para documentação
COMMENT ON COLUMN aulas.instrutor_id IS 'Instrutor designado para esta aula específica. Se NULL, usa instrutor_padrao_id da turma.';

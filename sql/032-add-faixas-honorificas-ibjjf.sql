-- 032-add-faixas-honorificas-ibjjf.sql
-- Adiciona faixas Coral e Vermelha (honoríficas) conforme regras IBJJF
-- Tempos mínimos baseados no regulamento oficial IBJJF

-- ═══════════════════════════════════════════════════════════════
-- 0. REMOVER CONSTRAINT QUE IMPEDE aulas_minimas = 0
--    Faixas honoríficas não exigem aulas, apenas tempo
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE regras_graduacao DROP CONSTRAINT IF EXISTS regras_graduacao_aulas_minimas_pos;
ALTER TABLE regras_graduacao DROP CONSTRAINT IF EXISTS regras_graduacao_meta_aulas_no_grau_pos;
ALTER TABLE regras_graduacao DROP CONSTRAINT IF EXISTS regras_graduacao_meta_pos;
ALTER TABLE regras_graduacao DROP CONSTRAINT IF EXISTS regras_graduacao_aulas_pos;

-- Recriar constraints permitindo 0 (zero significa "não se aplica")
ALTER TABLE regras_graduacao ADD CONSTRAINT regras_graduacao_aulas_minimas_pos 
  CHECK (aulas_minimas >= 0);
ALTER TABLE regras_graduacao ADD CONSTRAINT regras_graduacao_meta_aulas_no_grau_pos 
  CHECK (meta_aulas_no_grau >= 0);
ALTER TABLE regras_graduacao ADD CONSTRAINT regras_graduacao_meta_pos 
  CHECK (meta_aulas_no_grau >= 0);
ALTER TABLE regras_graduacao ADD CONSTRAINT regras_graduacao_aulas_pos 
  CHECK (aulas_minimas >= 0);

-- ═══════════════════════════════════════════════════════════════
-- 1. ADICIONAR FAIXAS HONORÍFICAS NA TABELA FAIXAS
-- ═══════════════════════════════════════════════════════════════

INSERT INTO faixas (slug, nome, categoria, ordem, graus_maximos)
VALUES
  -- Coral (7° e 8° grau da preta)
  ('coral',        'Faixa Coral',         'HONORIFICA', 6, 2),
  ('coral_preta',  'Coral Preta/Vermelha','HONORIFICA', 7, 1),  -- 7° grau
  ('coral_branca', 'Coral Branca/Vermelha','HONORIFICA', 8, 1), -- 8° grau
  
  -- Vermelha (9° e 10° grau)
  ('vermelha',     'Faixa Vermelha',      'HONORIFICA', 9, 2)   -- 9° e 10° grau
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. ADICIONAR REGRAS DEFAULT PARA FAIXAS HONORÍFICAS
--    Baseado nas regras IBJJF:
--    - 7° grau (Coral Preta/Vermelha): 7 anos no 6° grau = 84 meses
--    - 8° grau (Coral Branca/Vermelha): 7 anos no 7° grau = 84 meses
--    - 9° grau (Vermelha): 10 anos no 8° grau = 120 meses
--    - 10° grau (Vermelha): Reservado para pioneiros
--
--    NOTA: aulas_minimas e meta_aulas_no_grau = 0 porque 
--    progressão é APENAS por tempo, não por frequência
-- ═══════════════════════════════════════════════════════════════

INSERT INTO regras_graduacao_default (faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
VALUES
  -- Coral genérica (caso academia use sem distinção)
  ('coral',        0, 84, 0),
  
  -- 7° grau: mínimo 7 anos (84 meses) no 6° grau da preta
  ('coral_preta',  0, 84, 0),
  
  -- 8° grau: mínimo 7 anos (84 meses) no 7° grau
  ('coral_branca', 0, 84, 0),
  
  -- 9°/10° grau: mínimo 10 anos (120 meses) no 8° grau
  ('vermelha',     0, 120, 0)
ON CONFLICT (faixa_slug) DO UPDATE SET
  aulas_minimas = EXCLUDED.aulas_minimas,
  tempo_minimo_meses = EXCLUDED.tempo_minimo_meses,
  meta_aulas_no_grau = EXCLUDED.meta_aulas_no_grau;

-- ═══════════════════════════════════════════════════════════════
-- 3. SINCRONIZAR COM ACADEMIAS EXISTENTES
--    Adiciona as novas regras para todas academias que ainda não têm
-- ═══════════════════════════════════════════════════════════════

INSERT INTO regras_graduacao (id, academia_id, faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
SELECT 
  gen_random_uuid(),
  a.id,
  d.faixa_slug,
  d.aulas_minimas,
  d.tempo_minimo_meses,
  d.meta_aulas_no_grau
FROM academias a
CROSS JOIN regras_graduacao_default d
WHERE d.faixa_slug IN ('coral', 'coral_preta', 'coral_branca', 'vermelha')
  AND NOT EXISTS (
    SELECT 1 FROM regras_graduacao r 
    WHERE r.academia_id = a.id AND r.faixa_slug = d.faixa_slug
  );

-- ═══════════════════════════════════════════════════════════════
-- 4. VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════

-- Para conferir as faixas honoríficas adicionadas:
-- SELECT slug, nome, categoria, ordem, graus_maximos FROM faixas WHERE categoria = 'HONORIFICA' ORDER BY ordem;

-- Para conferir os defaults:
-- SELECT faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau 
-- FROM regras_graduacao_default 
-- WHERE faixa_slug IN ('coral', 'coral_preta', 'coral_branca', 'vermelha');

-- Total de faixas deve ser 21:
-- 5 adulto + 12 infantil + 4 honorífica = 21
-- SELECT categoria, COUNT(*) FROM faixas GROUP BY categoria;

-- 031-add-missing-faixas-default.sql
-- Adiciona faixas faltantes à tabela regras_graduacao_default
-- Corrige erro: "Regras de graduação não configuradas para esta faixa (nem default encontrado)"

-- ═══════════════════════════════════════════════════════════════
-- 1. ADICIONAR FAIXAS FALTANTES AO DEFAULT (apenas se existirem na tabela faixas)
-- ═══════════════════════════════════════════════════════════════

-- Usando CTE para inserir apenas faixas que existem
INSERT INTO regras_graduacao_default (faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
SELECT v.faixa_slug, v.aulas_minimas, v.tempo_minimo_meses, v.meta_aulas_no_grau
FROM (
  VALUES
    -- Faixas adulto adicionais (variantes)
    ('branca_infantil', 48, 6, 8),
    ('preta_professor', 900, 36, 150),
    ('preta_competidor', 900, 36, 150),
    -- Faixas coral e vermelha (honoríficas)
    ('coral_preta', 1200, 120, 200),
    ('coral_branca', 1200, 120, 200),
    ('vermelha', 1500, 120, 250)
) AS v(faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
WHERE EXISTS (SELECT 1 FROM faixas f WHERE f.slug = v.faixa_slug)
ON CONFLICT (faixa_slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 2. SINCRONIZAR COM ACADEMIAS EXISTENTES
-- ═══════════════════════════════════════════════════════════════

-- Para cada academia, inserir as novas regras se não existirem
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
WHERE NOT EXISTS (
  SELECT 1 FROM regras_graduacao r 
  WHERE r.academia_id = a.id AND r.faixa_slug = d.faixa_slug
);

-- ═══════════════════════════════════════════════════════════════
-- 3. VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════

-- SELECT faixa_slug, aulas_minimas, meta_aulas_no_grau FROM regras_graduacao_default ORDER BY faixa_slug;

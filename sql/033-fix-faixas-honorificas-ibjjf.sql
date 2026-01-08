-- 033-fix-faixas-honorificas-ibjjf.sql
-- Corrige faixas honoríficas para conformidade IBJJF
-- Remove faixa "coral" genérica (IBJJF só tem coral_preta e coral_branca)

-- ═══════════════════════════════════════════════════════════════
-- 1. REMOVER FAIXA CORAL GENÉRICA (não existe na IBJJF)
-- ═══════════════════════════════════════════════════════════════

-- Remover regras das academias
DELETE FROM regras_graduacao WHERE faixa_slug = 'coral';

-- Remover do default
DELETE FROM regras_graduacao_default WHERE faixa_slug = 'coral';

-- Remover da tabela faixas
DELETE FROM faixas WHERE slug = 'coral';

-- ═══════════════════════════════════════════════════════════════
-- 2. VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════

-- Deve retornar apenas 3 faixas honoríficas:
-- coral_preta, coral_branca, vermelha
-- SELECT slug, nome FROM faixas WHERE categoria = 'HONORIFICA' ORDER BY ordem;

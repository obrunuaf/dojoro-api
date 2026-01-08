-- 032-fix-usuarios-sem-faixa.sql
-- Corrige usuários existentes que estão sem faixa atribuída
-- Esses usuários agora causam erro no módulo de graduações

-- ═══════════════════════════════════════════════════════════════
-- 1. ATUALIZAR ALUNOS SEM FAIXA PARA FAIXA BRANCA
-- ═══════════════════════════════════════════════════════════════

UPDATE usuarios u
SET 
  faixa_atual_slug = 'branca',
  grau_atual = 0
WHERE u.faixa_atual_slug IS NULL
  AND u.status = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM usuarios_papeis up 
    WHERE up.usuario_id = u.id 
    AND up.papel = 'ALUNO'
  );

-- ═══════════════════════════════════════════════════════════════
-- 2. VERIFICAÇÃO
-- ═══════════════════════════════════════════════════════════════

-- Após executar, nenhum aluno ativo deve ter faixa nula:
-- SELECT COUNT(*) FROM usuarios u
-- WHERE u.faixa_atual_slug IS NULL
-- AND EXISTS (SELECT 1 FROM usuarios_papeis up WHERE up.usuario_id = u.id AND up.papel = 'ALUNO');
-- Deve retornar 0

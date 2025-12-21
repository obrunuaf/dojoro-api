-- ============================================
-- Seed: Aulas de teste para a próxima semana
-- Data: 2024-12-21
-- ============================================

-- Este script cria aulas para os próximos 7 dias
-- para que a tela de Agenda tenha dados para exibir

DO $$
DECLARE
  v_academia_id UUID;
  v_turma_adulto_gi UUID;
  v_turma_nogi UUID;
  v_turma_kids UUID;
  v_turma_competicao UUID;
  v_instrutor_id UUID;
  v_hoje DATE := CURRENT_DATE;
  v_data DATE;
  i INTEGER;
BEGIN
  -- Buscar a academia de demonstração
  SELECT id INTO v_academia_id FROM academias LIMIT 1;
  
  IF v_academia_id IS NULL THEN
    RAISE NOTICE 'Nenhuma academia encontrada!';
    RETURN;
  END IF;

  -- Buscar turmas existentes ou criar uma genérica
  SELECT id INTO v_turma_adulto_gi 
  FROM turmas 
  WHERE academia_id = v_academia_id 
    AND nome ILIKE '%adulto%gi%'
  LIMIT 1;

  SELECT id INTO v_turma_nogi 
  FROM turmas 
  WHERE academia_id = v_academia_id 
    AND (nome ILIKE '%no-gi%' OR nome ILIKE '%nogi%')
  LIMIT 1;

  SELECT id INTO v_turma_kids 
  FROM turmas 
  WHERE academia_id = v_academia_id 
    AND (nome ILIKE '%kids%' OR nome ILIKE '%infantil%' OR nome ILIKE '%criança%')
  LIMIT 1;

  -- Buscar instrutor
  SELECT u.id INTO v_instrutor_id
  FROM usuarios u
  JOIN usuarios_papeis up ON up.usuario_id = u.id
  WHERE up.academia_id = v_academia_id
    AND up.papel = 'PROFESSOR'
  LIMIT 1;

  -- Se não encontrar turmas, usar as que existirem
  IF v_turma_adulto_gi IS NULL THEN
    SELECT id INTO v_turma_adulto_gi 
    FROM turmas 
    WHERE academia_id = v_academia_id 
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_turma_nogi IS NULL THEN
    v_turma_nogi := v_turma_adulto_gi;
  END IF;

  IF v_turma_kids IS NULL THEN
    v_turma_kids := v_turma_adulto_gi;
  END IF;

  IF v_turma_adulto_gi IS NULL THEN
    RAISE NOTICE 'Nenhuma turma encontrada!';
    RETURN;
  END IF;

  RAISE NOTICE 'Academia: %, Turma: %, Instrutor: %', v_academia_id, v_turma_adulto_gi, v_instrutor_id;

  -- Criar aulas para os próximos 7 dias
  FOR i IN 0..6 LOOP
    v_data := v_hoje + i;
    
    -- Aula da manhã - 06:00 às 07:30
    INSERT INTO aulas (academia_id, turma_id, instrutor_id, data_inicio, data_fim, status)
    VALUES (
      v_academia_id,
      v_turma_adulto_gi,
      v_instrutor_id,
      (v_data || ' 06:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
      (v_data || ' 07:30:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
      CASE WHEN v_data < v_hoje THEN 'ENCERRADA' ELSE 'AGENDADA' END
    )
    ON CONFLICT DO NOTHING;

    -- Aula do meio-dia - 12:00 às 13:30
    INSERT INTO aulas (academia_id, turma_id, instrutor_id, data_inicio, data_fim, status)
    VALUES (
      v_academia_id,
      v_turma_nogi,
      v_instrutor_id,
      (v_data || ' 12:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
      (v_data || ' 13:30:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
      CASE WHEN v_data < v_hoje THEN 'ENCERRADA' ELSE 'AGENDADA' END
    )
    ON CONFLICT DO NOTHING;

    -- Aula da tarde (Kids) - Apenas dias de semana (seg-sex)
    IF EXTRACT(DOW FROM v_data) BETWEEN 1 AND 5 THEN
      INSERT INTO aulas (academia_id, turma_id, instrutor_id, data_inicio, data_fim, status)
      VALUES (
        v_academia_id,
        v_turma_kids,
        v_instrutor_id,
        (v_data || ' 16:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
        (v_data || ' 17:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
        CASE WHEN v_data < v_hoje THEN 'ENCERRADA' ELSE 'AGENDADA' END
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Aula da noite - 19:00 às 21:00
    INSERT INTO aulas (academia_id, turma_id, instrutor_id, data_inicio, data_fim, status)
    VALUES (
      v_academia_id,
      v_turma_adulto_gi,
      v_instrutor_id,
      (v_data || ' 19:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
      (v_data || ' 21:00:00')::timestamp AT TIME ZONE 'America/Sao_Paulo',
      CASE WHEN v_data < v_hoje THEN 'ENCERRADA' ELSE 'AGENDADA' END
    )
    ON CONFLICT DO NOTHING;

  END LOOP;

  RAISE NOTICE 'Aulas criadas para os próximos 7 dias!';
END $$;

-- ============================================
-- Verificar aulas criadas
-- ============================================
SELECT 
  a.id,
  t.nome AS turma,
  a.data_inicio AT TIME ZONE 'America/Sao_Paulo' AS horario,
  a.status,
  u.nome_completo AS instrutor
FROM aulas a
JOIN turmas t ON t.id = a.turma_id
LEFT JOIN usuarios u ON u.id = a.instrutor_id
WHERE a.data_inicio >= CURRENT_DATE
ORDER BY a.data_inicio
LIMIT 30;

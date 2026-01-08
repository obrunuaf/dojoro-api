-- 030-graduacoes-campos-transicao.sql
-- Adiciona campos de histórico de transição na tabela graduacoes
-- e status para fluxo de confirmação

-- ═══════════════════════════════════════════════════════════════
-- 1. ADICIONAR CAMPOS DE TRANSIÇÃO NA TABELA GRADUAÇÕES
-- ═══════════════════════════════════════════════════════════════

DO $$ 
BEGIN
  -- Faixa anterior (para histórico de upgrade de faixa)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'graduacoes' AND column_name = 'faixa_anterior_slug'
  ) THEN
    ALTER TABLE graduacoes ADD COLUMN faixa_anterior_slug VARCHAR(50) REFERENCES faixas(slug);
  END IF;

  -- Grau anterior
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'graduacoes' AND column_name = 'grau_anterior'
  ) THEN
    ALTER TABLE graduacoes ADD COLUMN grau_anterior INTEGER DEFAULT 0;
  END IF;

  -- Aula vinculada (graduação durante aula específica)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'graduacoes' AND column_name = 'aula_vinculada_id'
  ) THEN
    ALTER TABLE graduacoes ADD COLUMN aula_vinculada_id UUID REFERENCES aulas(id);
  END IF;

  -- Status da graduação (PENDENTE, CONFIRMADA, CANCELADA)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'graduacoes' AND column_name = 'status'
  ) THEN
    ALTER TABLE graduacoes ADD COLUMN status VARCHAR(20) DEFAULT 'CONFIRMADA'
      CHECK (status IN ('PENDENTE', 'CONFIRMADA', 'CANCELADA'));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 2. ADICIONAR CAMPOS EM REGRAS_GRADUACAO (se não existem)
-- ═══════════════════════════════════════════════════════════════

DO $$ 
BEGIN
  -- Frequência mínima semanal
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'regras_graduacao' AND column_name = 'frequencia_minima_semanal'
  ) THEN
    ALTER TABLE regras_graduacao ADD COLUMN frequencia_minima_semanal DECIMAL(3,1);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 3. ÍNDICES PARA PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_graduacoes_status ON graduacoes(status);
CREATE INDEX IF NOT EXISTS idx_graduacoes_data ON graduacoes(data_graduacao);
CREATE INDEX IF NOT EXISTS idx_graduacoes_aluno ON graduacoes(usuario_id);

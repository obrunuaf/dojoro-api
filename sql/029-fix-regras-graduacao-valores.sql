-- 029-fix-regras-graduacao-valores.sql
-- Corrige os valores de meta_aulas_no_grau e aulas_minimas
-- para que sejam diferentes (evita bug de progresso 100% simultâneo)
-- Valores baseados no Kanri + IBJJF

-- ═══════════════════════════════════════════════════════════════
-- 1. CRIAR TABELA DE DEFAULTS (template para novas academias)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS regras_graduacao_default (
  faixa_slug         varchar(50) PRIMARY KEY REFERENCES faixas(slug),
  aulas_minimas      integer NOT NULL,
  tempo_minimo_meses integer NOT NULL,
  meta_aulas_no_grau integer NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- 2. POPULAR DEFAULTS (valores Kanri aprovados)
--    NOTA: coral e vermelha serão adicionadas quando faixas existirem
-- ═══════════════════════════════════════════════════════════════

INSERT INTO regras_graduacao_default (faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau) VALUES
  -- ADULTO (progressão crescente)
  ('branca',  120,  12,  30),
  ('azul',    160,  24,  40),
  ('roxa',    200,  18,  50),
  ('marrom',  360,  12,  90),
  ('preta',   900,  36, 150),
  
  -- INFANTIL (8 aulas/grau, 48 total)
  ('cinza',         48, 6, 8),
  ('cinza_branca',  48, 6, 8),
  ('cinza_preta',   48, 6, 8),
  ('amarela',       48, 6, 8),
  ('amarela_branca',48, 6, 8),
  ('amarela_preta', 48, 6, 8),
  ('laranja',       48, 6, 8),
  ('laranja_branca',48, 6, 8),
  ('laranja_preta', 48, 6, 8),
  ('verde',         48, 6, 8),
  ('verde_branca',  48, 6, 8),
  ('verde_preta',   48, 6, 8)
ON CONFLICT (faixa_slug) DO UPDATE SET
  aulas_minimas = EXCLUDED.aulas_minimas,
  tempo_minimo_meses = EXCLUDED.tempo_minimo_meses,
  meta_aulas_no_grau = EXCLUDED.meta_aulas_no_grau;

-- ═══════════════════════════════════════════════════════════════
-- 3. ATUALIZAR ACADEMIAS EXISTENTES (copia dos defaults)
-- ═══════════════════════════════════════════════════════════════

UPDATE regras_graduacao rg
SET 
  aulas_minimas = d.aulas_minimas,
  tempo_minimo_meses = d.tempo_minimo_meses,
  meta_aulas_no_grau = d.meta_aulas_no_grau
FROM regras_graduacao_default d
WHERE rg.faixa_slug = d.faixa_slug;

-- ═══════════════════════════════════════════════════════════════
-- 4. ADICIONAR CAMPO modo_graduacao NA TABELA academias
-- ═══════════════════════════════════════════════════════════════

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'academias' AND column_name = 'modo_graduacao'
  ) THEN
    ALTER TABLE academias ADD COLUMN modo_graduacao varchar(20) 
      DEFAULT 'PERSONALIZADO' 
      CHECK (modo_graduacao IN ('TRIMESTRAL', 'SEMESTRAL', 'ANUAL', 'PERSONALIZADO'));
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- 5. CRIAR TRIGGER PARA NOVAS ACADEMIAS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION copiar_regras_para_nova_academia()
RETURNS TRIGGER AS $$
DECLARE
  multiplicador integer;
BEGIN
  -- Define multiplicador baseado no modo
  multiplicador := CASE NEW.modo_graduacao
    WHEN 'TRIMESTRAL' THEN 1
    WHEN 'SEMESTRAL' THEN 2
    WHEN 'ANUAL' THEN 4
    ELSE 1  -- PERSONALIZADO usa valores default direto
  END;

  -- Copia valores do template, aplicando multiplicador se necessário
  INSERT INTO regras_graduacao (
    id, academia_id, faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau
  )
  SELECT 
    gen_random_uuid(),
    NEW.id,
    faixa_slug,
    CASE WHEN NEW.modo_graduacao = 'PERSONALIZADO' THEN aulas_minimas 
         ELSE aulas_minimas * multiplicador END,
    CASE WHEN NEW.modo_graduacao = 'PERSONALIZADO' THEN tempo_minimo_meses 
         ELSE tempo_minimo_meses * multiplicador END,
    CASE WHEN NEW.modo_graduacao = 'PERSONALIZADO' THEN meta_aulas_no_grau 
         ELSE meta_aulas_no_grau * multiplicador END
  FROM regras_graduacao_default;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS tr_academia_regras_default ON academias;

-- Cria novo trigger
CREATE TRIGGER tr_academia_regras_default
AFTER INSERT ON academias
FOR EACH ROW
EXECUTE FUNCTION copiar_regras_para_nova_academia();

-- ═══════════════════════════════════════════════════════════════
-- VERIFICAÇÃO: Conferir valores atualizados
-- ═══════════════════════════════════════════════════════════════

-- SELECT faixa_slug, aulas_minimas, meta_aulas_no_grau, tempo_minimo_meses
-- FROM regras_graduacao
-- WHERE academia_id = 'SEU_ACADEMIA_ID'
-- ORDER BY faixa_slug;

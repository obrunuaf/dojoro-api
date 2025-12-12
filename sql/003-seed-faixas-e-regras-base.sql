-- 003-seed-faixas-e-regras-base.sql
-- Executar depois do 001-init-schema.sql
-- Preenche TODAS as faixas (kids + adulto) e cria
-- regras de graduação base para TODAS as academias existentes.

create extension if not exists "pgcrypto";

-- =========================================
-- 1) FAIXAS ADULTO (garante que existem)
-- =========================================

insert into faixas (slug, nome, categoria, ordem, graus_maximos)
values
  ('branca', 'Faixa Branca', 'ADULTO', 1, 4),
  ('azul',   'Faixa Azul',   'ADULTO', 2, 4),
  ('roxa',   'Faixa Roxa',   'ADULTO', 3, 4),
  ('marrom', 'Faixa Marrom', 'ADULTO', 4, 4),
  ('preta',  'Faixa Preta',  'ADULTO', 5, 6)
on conflict (slug) do nothing;

-- =========================================
-- 2) FAIXAS INFANTIS (KIDS)
--    Padrão IBJJF: Cinza, Amarela, Laranja, Verde
--    com variações branca/preta
-- =========================================

insert into faixas (slug, nome, categoria, ordem, graus_maximos)
values
  -- CINZA
  ('cinza_branca', 'Cinza e Branca', 'INFANTIL', 1, 4),
  ('cinza',        'Cinza',          'INFANTIL', 2, 4),
  ('cinza_preta',  'Cinza e Preta',  'INFANTIL', 3, 4),

  -- AMARELA
  ('amarela_branca', 'Amarela e Branca', 'INFANTIL', 4, 4),
  ('amarela',        'Amarela',          'INFANTIL', 5, 4),
  ('amarela_preta',  'Amarela e Preta',  'INFANTIL', 6, 4),

  -- LARANJA
  ('laranja_branca', 'Laranja e Branca', 'INFANTIL', 7, 4),
  ('laranja',        'Laranja',          'INFANTIL', 8, 4),
  ('laranja_preta',  'Laranja e Preta',  'INFANTIL', 9, 4),

  -- VERDE
  ('verde_branca', 'Verde e Branca', 'INFANTIL', 10, 4),
  ('verde',        'Verde',          'INFANTIL', 11, 4),
  ('verde_preta',  'Verde e Preta',  'INFANTIL', 12, 4)
on conflict (slug) do nothing;

-- Observação:
-- "ordem" é utilizada para ordenar DENTRO da categoria.
-- Podem existir ordens repetidas entre ADULTO/INFANTIL sem problema,
-- desde que consultas filtrem por categoria quando necessário.

-- =========================================
-- 3) REGRAS BASE POR FAIXA (ADULTO + INFANTIL)
--    Serão copiadas para TODAS as academias existentes.
--    Cada academia pode depois ajustar as suas.
-- =========================================

-- ADULTO: regras base (exemplo que você já citou)
-- branca: 40 aulas / 6 meses
-- azul:   60 aulas / 12 meses
-- roxa:   80 aulas / 18 meses
-- marrom: 100 aulas / 24 meses
-- preta:  120 aulas / 36 meses (ajustavel por academia)

-- INFANTIL: valores sugeridos (podem ser ajustados pelo professor)
-- ideia: progressão suave, com metas menores que adulto

insert into regras_graduacao (
  academia_id,
  faixa_slug,
  aulas_minimas,
  tempo_minimo_meses,
  meta_aulas_no_grau
)
select
  a.id as academia_id,
  r.faixa_slug,
  r.aulas_minimas,
  r.tempo_minimo_meses,
  r.meta_aulas_no_grau
from academias a
cross join (
  values
    -- ADULTO
    ('branca',        40,  6,  40),
    ('azul',          60, 12,  60),
    ('roxa',          80, 18,  80),
    ('marrom',       100, 24, 100),
    ('preta',        120, 36, 120),  -- pode ser ajustado por academia

    -- INFANTIL - CINZA
    ('cinza_branca',  20,  3,  20),
    ('cinza',         25,  3,  25),
    ('cinza_preta',   30,  3,  30),

    -- INFANTIL - AMARELA
    ('amarela_branca', 20,  3,  20),
    ('amarela',        25,  3,  25),
    ('amarela_preta',  30,  3,  30),

    -- INFANTIL - LARANJA
    ('laranja_branca', 20,  3,  20),
    ('laranja',        25,  3,  25),
    ('laranja_preta',  30,  3,  30),

    -- INFANTIL - VERDE
    ('verde_branca',   20,  4,  20),
    ('verde',          25,  4,  25),
    ('verde_preta',    30,  4,  30)
) as r(faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
where exists (
  select 1 from faixas f
  where f.slug = r.faixa_slug
)
on conflict (academia_id, faixa_slug) do nothing;

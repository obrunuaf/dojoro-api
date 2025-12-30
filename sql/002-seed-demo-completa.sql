-- SEED DEMO COMPLETA DOJORO
-- ATENÇÃO: execute após ter rodado o 001-init-schema.sql

-- Garante extensão de crypto (para gen_random_uuid / crypt)
create extension if not exists "pgcrypto";

-- ============================
-- 1) FAIXAS BÁSICAS (ADULTO)
-- ============================

insert into faixas (slug, nome, categoria, ordem, graus_maximos)
values
  ('branca', 'Faixa Branca', 'ADULTO', 1, 4),
  ('azul',   'Faixa Azul',   'ADULTO', 2, 4),
  ('roxa',   'Faixa Roxa',   'ADULTO', 3, 4),
  ('marrom', 'Faixa Marrom', 'ADULTO', 4, 4),
  ('preta',  'Faixa Preta',  'ADULTO', 5, 6)
on conflict (slug) do nothing;

-- ============================
-- 2) ACADEMIA DEMO
-- ============================

insert into academias (nome, codigo_convite, ativo)
values ('Dojoro Seed Academy', 'DOJ-SEED1', true)
on conflict (codigo_convite) do nothing;

-- ============================
-- 3) TIPOS DE TREINO (GI / NO-GI / KIDS)
-- ============================

insert into tipos_treino (academia_id, codigo, nome, descricao, cor_identificacao)
select a.id, x.codigo, x.nome, x.descricao, x.cor
from academias a
cross join (
  values
    ('gi',   'Gi Adulto',    'Treino com kimono',  '#3b82f6'),
    ('nogi', 'No-Gi Adulto', 'Treino sem kimono',  '#f97316'),
    ('kids', 'Kids',         'Aulas infantis',     '#22c55e')
) as x(codigo, nome, descricao, cor)
where a.codigo_convite = 'DOJ-SEED1'
on conflict (academia_id, codigo) do nothing;

-- ============================
-- 4) USUÁRIOS (1 por perfil)
-- ============================
-- Senhas:
--   Aluno:     SenhaAluno123
--   Instrutor: SenhaInstrutor123
--   Professor: SenhaProfessor123
--   Admin:     SenhaAdmin123
--   TI:        SenhaTi123

insert into usuarios (email, senha_hash, nome_completo, status, faixa_atual_slug, grau_atual, aceitou_termos)
values
  ('aluno.seed@example.com',
    crypt('SenhaAluno123', gen_salt('bf')),
    'Aluno Seed',
    'ACTIVE',
    'azul',   -- faixa atual
    1,        -- 1º grau
    true),

  ('instrutor.seed@example.com',
    crypt('SenhaInstrutor123', gen_salt('bf')),
    'Instrutor Seed',
    'ACTIVE',
    null,   -- faixa_atual_slug deve ser null para permitir escolha no completar perfil
    0,
    true),

  ('professor.seed@example.com',
    crypt('SenhaProfessor123', gen_salt('bf')),
    'Professor Seed',
    'ACTIVE',
    'preta',
    2,
    true),

  ('admin.seed@example.com',
    crypt('SenhaAdmin123', gen_salt('bf')),
    'Admin Seed',
    'ACTIVE',
    'roxa',
    0,
    true),

  ('ti.seed@example.com',
    crypt('SenhaTi123', gen_salt('bf')),
    'TI Seed',
    'ACTIVE',
    'preta',
    0,
    true)
on conflict (email) do nothing;

-- ============================
-- 5) PAPÉIS POR USUÁRIO
-- ============================
-- Todo mundo também é ALUNO na mesma academia, além do papel principal.

insert into usuarios_papeis (usuario_id, academia_id, papel)
select u.id, a.id, p.papel
from academias a
join (
  values
    ('aluno.seed@example.com',     'ALUNO'),
    ('instrutor.seed@example.com', 'ALUNO'),
    ('instrutor.seed@example.com', 'INSTRUTOR'),
    ('professor.seed@example.com', 'ALUNO'),
    ('professor.seed@example.com', 'PROFESSOR'),
    ('admin.seed@example.com',     'ALUNO'),
    ('admin.seed@example.com',     'ADMIN'),
    ('ti.seed@example.com',        'ALUNO'),
    ('ti.seed@example.com',        'TI')
) as p(email, papel)
  on true
join usuarios u
  on u.email = p.email
where a.codigo_convite = 'DOJ-SEED1'
on conflict (usuario_id, academia_id, papel) do nothing;

-- ============================
-- 6) MATRÍCULAS (1 para cada usuário)
-- ============================

insert into matriculas (usuario_id, academia_id, numero_matricula, status, data_inicio)
select
  u.id,
  a.id,
  row_number() over (order by u.email) as numero_matricula,
  'ATIVA' as status,
  date '2025-06-01' as data_inicio
from academias a
join usuarios u
  on u.email in (
    'aluno.seed@example.com',
    'instrutor.seed@example.com',
    'professor.seed@example.com',
    'admin.seed@example.com',
    'ti.seed@example.com'
  )
where a.codigo_convite = 'DOJ-SEED1'
on conflict (academia_id, numero_matricula) do nothing;

-- ============================
-- 7) REGRAS DE GRADUAÇÃO (BÁSICAS)
-- ============================

insert into regras_graduacao (academia_id, faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
select a.id, x.faixa_slug, x.aulas_minimas, x.tempo_minimo_meses, x.meta_aulas_no_grau
from academias a
cross join (
  values
    ('branca',  40, 6, 40),
    ('azul',    60, 12, 60),
    ('roxa',    80, 18, 80),
    ('marrom', 100, 24, 100),
    ('preta',  120, 36, 120)
) as x(faixa_slug, aulas_minimas, tempo_minimo_meses, meta_aulas_no_grau)
where a.codigo_convite = 'DOJ-SEED1'
on conflict (academia_id, faixa_slug) do nothing;

-- ============================
-- 8) TURMA ADULTO GI NOITE
-- ============================

insert into turmas (academia_id, tipo_treino_id, nome, dias_semana, hora_inicio, hora_fim, instrutor_padrao_id)
select
  a.id as academia_id,
  tt.id as tipo_treino_id,
  'Adulto Gi Noite' as nome,
  array[1,3] as dias_semana,      -- Segunda (1) e Quarta (3)
  time '19:00' as hora_inicio,
  time '20:30' as hora_fim,
  instrutor.id as instrutor_padrao_id
from academias a
join tipos_treino tt
  on tt.academia_id = a.id
 and tt.codigo = 'gi'
join usuarios instrutor
  on instrutor.email = 'instrutor.seed@example.com'
where a.codigo_convite = 'DOJ-SEED1'
  and not exists (
    select 1 from turmas t
    where t.academia_id = a.id
      and t.nome = 'Adulto Gi Noite'
  );

-- 8b) TURMA NO-GI MANHA
insert into turmas (academia_id, tipo_treino_id, nome, dias_semana, hora_inicio, hora_fim, instrutor_padrao_id)
select
  a.id as academia_id,
  tt.id as tipo_treino_id,
  'No-Gi Manha' as nome,
  array[2,4] as dias_semana,      -- Terca (2) e Quinta (4)
  time '07:30' as hora_inicio,
  time '09:00' as hora_fim,
  professor.id as instrutor_padrao_id
from academias a
join tipos_treino tt
  on tt.academia_id = a.id
 and tt.codigo = 'nogi'
left join usuarios professor
  on professor.email = 'professor.seed@example.com'
where a.codigo_convite = 'DOJ-SEED1'
  and not exists (
    select 1 from turmas t
    where t.academia_id = a.id
      and t.nome = 'No-Gi Manha'
  );

-- ============================
-- 9) AULAS (3 meses, seg/qua à noite)
-- ============================
-- Período: 2025-09-01 a 2025-11-30

insert into aulas (academia_id, turma_id, data_inicio, data_fim, status, qr_token, qr_expires_at)
select
  a.id as academia_id,
  t.id as turma_id,
  (d::timestamptz + time '19:00') as data_inicio,
  (d::timestamptz + time '20:30') as data_fim,
  'ENCERRADA' as status,
  null as qr_token,
  null as qr_expires_at
from academias a
join turmas t
  on t.academia_id = a.id
 and t.nome = 'Adulto Gi Noite'
cross join generate_series(date '2025-09-01', date '2025-11-30', interval '1 day') as d
where a.codigo_convite = 'DOJ-SEED1'
  and extract(dow from d) in (1,3) -- 1 = Monday, 3 = Wednesday
  and not exists (
    select 1 from aulas au
    where au.turma_id = t.id
      and date(au.data_inicio) = d
  );

-- Aula garantida "hoje" para cenários de teste (se não existir ainda)
with hoje as (
  select (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo' as dia
)
insert into aulas (academia_id, turma_id, data_inicio, data_fim, status, qr_token, qr_expires_at)
select
  a.id as academia_id,
  t.id as turma_id,
  (h.dia + time '19:00') as data_inicio,
  (h.dia + time '20:30') as data_fim,
  'AGENDADA' as status,
  null,
  null
from academias a
cross join hoje h
join turmas t
  on t.academia_id = a.id
 and t.nome = 'Adulto Gi Noite'
where a.codigo_convite = 'DOJ-SEED1'
  and not exists (
    select 1 from aulas au
    where au.turma_id = t.id
      and au.data_inicio::date = h.dia::date
  );

-- Aulas futuras (proximos 21 dias) para todas as turmas ativas da academia seed
with janela as (
  select
    (date_trunc('day', now() at time zone 'America/Sao_Paulo'))::date as inicio,
    (date_trunc('day', now() at time zone 'America/Sao_Paulo') + interval '21 day')::date as fim
)
insert into aulas (academia_id, turma_id, data_inicio, data_fim, status)
select
  a.id as academia_id,
  t.id as turma_id,
  (g.dia + t.hora_inicio) at time zone 'America/Sao_Paulo' as data_inicio,
  (g.dia + t.hora_fim) at time zone 'America/Sao_Paulo' as data_fim,
  'AGENDADA' as status
from turmas t
join academias a on a.id = t.academia_id
cross join janela j
cross join generate_series(j.inicio, j.fim, interval '1 day') as g(dia)
where a.codigo_convite = 'DOJ-SEED1'
  and extract(dow from g.dia) = any(t.dias_semana)
  and not exists (
    select 1 from aulas au
    where au.turma_id = t.id
      and date(au.data_inicio) = g.dia
  );

-- Presenca PENDENTE garantida na aula de hoje para teste rapido (aluno seed)
with aula_hoje as (
  select au.id as aula_id, au.academia_id
  from aulas au
  join turmas t on t.id = au.turma_id
  join academias a on a.id = au.academia_id
  cross join (select (date_trunc('day', now() at time zone 'America/Sao_Paulo'))::date as dia) h
  where a.codigo_convite = 'DOJ-SEED1'
    and t.nome = 'Adulto Gi Noite'
    and au.data_inicio::date = h.dia
  limit 1
),
aluno_seed as (
  select id as aluno_id
  from usuarios
  where email = 'aluno.seed@example.com'
  limit 1
)
update presencas p
set status = 'PENDENTE',
    origem = coalesce(p.origem, 'QR_CODE'),
    registrado_por = (select aluno_id from aluno_seed),
    aprovacao_status = 'PENDENTE',
    aprovado_por = null,
    aprovado_em = null,
    rejeitado_por = null,
    rejeitado_em = null,
    aprovacao_observacao = null
where p.academia_id = (select academia_id from aula_hoje)
  and p.aula_id = (select aula_id from aula_hoje)
  and p.aluno_id = (select aluno_id from aluno_seed);

insert into presencas (academia_id, aula_id, aluno_id, status, origem, registrado_por, aprovacao_status)
select
  ah.academia_id,
  ah.aula_id,
  a.aluno_id,
  'PENDENTE',
  'QR_CODE',
  a.aluno_id,
  'PENDENTE'
from aula_hoje ah, aluno_seed a
where not exists (
  select 1
  from presencas p
  where p.aula_id = ah.aula_id
    and p.aluno_id = a.aluno_id
);

-- ============================
-- 10) GRADUAÇÕES (FAIXA / GRAU)
-- ============================

-- Vamos usar o Professor Seed como "assinante" das graduações.
insert into graduacoes (usuario_id, academia_id, faixa_slug, grau, data_graduacao, professor_id, observacoes)
select
  u.id as usuario_id,
  a.id as academia_id,
  g.faixa_slug,
  g.grau,
  g.data_graduacao,
  prof.id as professor_id,
  g.obs as observacoes
from academias a
join usuarios u
  on u.email in (
    'aluno.seed@example.com',
    'instrutor.seed@example.com',
    'professor.seed@example.com',
    'admin.seed@example.com',
    'ti.seed@example.com'
  )
join (
  values
    -- Aluno: branca -> azul (grau 0) e depois grau 1
    ('aluno.seed@example.com',    'branca', date '2024-01-10', 0, 'Início na faixa branca'),
    ('aluno.seed@example.com',    'azul',   date '2025-07-18', 1, 'Primeiro grau na faixa azul'),

    -- Instrutor: roxa -> marrom
    ('instrutor.seed@example.com','roxa',   date '2023-06-15', 0, 'Graduado à faixa roxa'),
    ('instrutor.seed@example.com','marrom', date '2025-02-20', 0, 'Subiu para marrom'),

    -- Professor: marrom -> preta (grau 2)
    ('professor.seed@example.com','marrom', date '2019-09-01', 0, 'Faixa marrom'),
    ('professor.seed@example.com','preta',  date '2023-06-15', 2, 'Faixa preta, segundo grau'),

    -- Admin: azul simples
    ('admin.seed@example.com',    'azul',   date '2023-03-01', 0, 'Faixa azul'),

    -- TI: preta simples
    ('ti.seed@example.com',       'preta',  date '2018-01-01', 0, 'Faixa preta')
) as g(email, faixa_slug, data_graduacao, grau, obs)
  on g.email = u.email
left join usuarios prof
  on prof.email = 'professor.seed@example.com'
where a.codigo_convite = 'DOJ-SEED1'
  and not exists (
    select 1 from graduacoes gr
    where gr.usuario_id = u.id
      and gr.academia_id = a.id
      and gr.faixa_slug = g.faixa_slug
      and gr.data_graduacao = g.data_graduacao
  );

-- ============================
-- 11) PRESENÇAS (3 meses, com faltas)
-- ============================

-- Regras simples:
-- - Aluno Seed: mais faltas (1 a cada 5 aulas)
-- - Admin Seed: algumas faltas (1 a cada 7 aulas)
-- - Outros: quase sempre presentes

insert into presencas (academia_id, aula_id, aluno_id, status, origem, registrado_por, criado_em)
select
  au.academia_id,
  au.id as aula_id,
  u.id as aluno_id,
  case
    when u.email = 'aluno.seed@example.com'
         and (extract(day from au.data_inicio)::int % 5 = 0)
      then 'FALTA'
    when u.email = 'admin.seed@example.com'
         and (extract(day from au.data_inicio)::int % 7 = 0)
      then 'FALTA'
    else 'PRESENTE'
  end as status,
  case
    when u.email = 'instrutor.seed@example.com' then 'SISTEMA'
    when u.email = 'professor.seed@example.com' then 'SISTEMA'
    else 'QR_CODE'
  end as origem,
  case
    when u.email in ('instrutor.seed@example.com', 'professor.seed@example.com')
      then u.id                         -- instrutor/professor marcando
    else aluno.id                       -- aluno (seed) se auto registrando
  end as registrado_por,
  au.data_inicio as criado_em
from aulas au
join turmas t
  on t.id = au.turma_id
join academias a
  on a.id = au.academia_id
join usuarios u
  on u.email in (
    'aluno.seed@example.com',
    'instrutor.seed@example.com',
    'professor.seed@example.com',
    'admin.seed@example.com',
    'ti.seed@example.com'
  )
left join usuarios aluno
  on aluno.email = 'aluno.seed@example.com'
where a.codigo_convite = 'DOJ-SEED1'
  and t.nome = 'Adulto Gi Noite'
  and not exists (
    select 1 from presencas p
    where p.aula_id = au.id
      and p.aluno_id = u.id
  );

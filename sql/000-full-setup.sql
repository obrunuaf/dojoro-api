-- ============================================
-- DOJORO DATABASE - FULL SETUP SCRIPT
-- Ordem correta para ambiente limpo
-- Última atualização: Dezembro 2024
-- ============================================

-- Este script consolida TODAS as migrations na ordem correta.
-- Use para: ambiente novo, reset completo, ou documentação.
-- NÃO execute em produção sem backup!

-- ============================================
-- 0) EXTENSÕES
-- ============================================

create extension if not exists "pgcrypto";

-- ============================================
-- 1) TABELAS DE DOMÍNIO
-- ============================================

-- Faixas (IBJJF)
create table if not exists faixas (
  slug              varchar(50) primary key,
  nome              varchar(50) not null,
  categoria         varchar(20) not null,     -- ADULTO / INFANTIL
  ordem             integer not null,
  graus_maximos     integer not null
);

-- Academias
create table if not exists academias (
  id                uuid primary key default gen_random_uuid(),
  nome              varchar(255) not null,
  codigo            varchar(20) unique,       -- Código público (DOJ-XXXX)
  codigo_convite    varchar(20) unique,       -- Código legado
  logo_url          text,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now()
);

-- Settings da Academia
create table if not exists academia_settings (
  id                uuid primary key default gen_random_uuid(),
  academia_id       uuid not null references academias(id) unique,
  qr_ttl_minutes    integer default 10,
  auto_approve_signup boolean default false,
  atualizado_em     timestamptz default now()
);

-- Redes (grupo de academias)
create table if not exists redes (
  id                uuid primary key default gen_random_uuid(),
  nome              varchar(255) not null,
  logo_url          text,
  criado_em         timestamptz not null default now()
);

-- ============================================
-- 2) USUÁRIOS / PAPÉIS / CONVITES
-- ============================================

create table if not exists usuarios (
  id                uuid primary key default gen_random_uuid(),
  email             varchar(254) not null unique,
  senha_hash        varchar(255) not null,
  nome_completo     varchar(120) not null,
  status            varchar(20) not null default 'ACTIVE',
  faixa_atual_slug  varchar(50),
  grau_atual        integer,
  aceitou_termos    boolean not null default false,
  telefone          varchar(20),
  data_nascimento   date,
  criado_em         timestamptz not null default now(),
  constraint fk_usuarios_faixa_atual
    foreign key (faixa_atual_slug) references faixas (slug)
);

create table if not exists usuarios_papeis (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios (id),
  academia_id       uuid not null references academias (id),
  papel             varchar(20) not null,   -- ALUNO / INSTRUTOR / PROFESSOR / ADMIN / TI
  criado_em         timestamptz not null default now(),
  constraint uq_usuarios_papeis unique (usuario_id, academia_id, papel)
);

-- Convites (com segurança OTP + signature)
create table if not exists convites (
  id                uuid primary key default gen_random_uuid(),
  academia_id       uuid not null references academias (id),
  email             varchar(254) not null,
  token_hash        varchar(255) not null unique,
  otp_code          varchar(6),
  signature         varchar(64),
  papel_sugerido    varchar(20) not null default 'ALUNO',
  expires_at        timestamptz,
  used_at           timestamptz,
  validation_attempts integer default 0,
  created_by        uuid references usuarios(id),
  used_by_ip        varchar(45),
  criado_em         timestamptz default now()
);

-- Password Reset Tokens
create table if not exists password_reset_tokens (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios(id),
  codigo_hash       varchar(255) not null,
  expires_at        timestamptz not null,
  used_at           timestamptz,
  criado_em         timestamptz not null default now()
);

-- Refresh Tokens
create table if not exists refresh_tokens (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios(id),
  token_hash        varchar(255) not null unique,
  device_info       text,
  ip_address        varchar(45),
  user_agent        text,
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  ultimo_uso        timestamptz,
  criado_em         timestamptz not null default now()
);

-- ============================================
-- 3) CONFIGURAÇÕES
-- ============================================

create table if not exists regras_graduacao (
  id                uuid primary key default gen_random_uuid(),
  academia_id       uuid not null references academias (id),
  faixa_slug        varchar(50) not null references faixas (slug),
  aulas_minimas     integer check (aulas_minimas is null or aulas_minimas > 0),
  tempo_minimo_meses integer,
  meta_aulas_no_grau integer check (meta_aulas_no_grau is null or meta_aulas_no_grau > 0),
  constraint uq_regras_graduacao unique (academia_id, faixa_slug)
);

create table if not exists tipos_treino (
  id                uuid primary key default gen_random_uuid(),
  academia_id       uuid not null references academias (id),
  codigo            varchar(50) not null,
  nome              varchar(50) not null,
  descricao         text,
  cor_identificacao varchar(7),
  constraint uq_tipos_treino unique (academia_id, nome),
  constraint uq_tipos_treino_codigo unique (academia_id, codigo)
);

-- ============================================
-- 4) TURMAS / AULAS
-- ============================================

create table if not exists turmas (
  id                  uuid primary key default gen_random_uuid(),
  academia_id         uuid not null references academias (id),
  tipo_treino_id      uuid not null references tipos_treino (id),
  nome                varchar(100) not null,
  dias_semana         integer[] not null,      -- 0-6 (Dom-Sáb)
  horario_padrao      time not null,
  instrutor_padrao_id uuid references usuarios (id),
  deleted_at          timestamptz,
  criado_em           timestamptz not null default now()
);

create table if not exists aulas (
  id                uuid primary key default gen_random_uuid(),
  academia_id       uuid not null references academias (id),
  turma_id          uuid not null references turmas (id),
  data_inicio       timestamptz not null,
  data_fim          timestamptz not null,
  status            varchar(20) not null default 'AGENDADA',
  qr_token          varchar(255),
  qr_expires_at     timestamptz,
  deleted_at        timestamptz,
  criado_em         timestamptz not null default now()
);

-- ============================================
-- 5) MATRÍCULAS / PRESENÇAS / GRADUAÇÕES
-- ============================================

create table if not exists matriculas (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios (id),
  academia_id       uuid not null references academias (id),
  numero_matricula  integer not null,
  status            varchar(20) not null default 'ATIVA', -- ATIVA / PENDENTE / TRANCADA / INADIMPLENTE / ENCERRADA
  data_inicio       date not null default current_date,
  data_fim          date,
  criado_em         timestamptz not null default now(),
  constraint uq_matriculas_numero unique (academia_id, numero_matricula)
);

create table if not exists presencas (
  id                uuid primary key default gen_random_uuid(),
  academia_id       uuid not null references academias (id),
  aula_id           uuid not null references aulas (id),
  aluno_id          uuid not null references usuarios (id),
  status            varchar(20) not null,
  origem            varchar(20) not null,
  registrado_por    uuid references usuarios (id),
  decidido_por      uuid references usuarios(id),
  decidido_em       timestamptz,
  observacao_decisao text,
  criado_em         timestamptz not null default now(),
  constraint uq_presencas_aula_aluno unique (aula_id, aluno_id)
);

create table if not exists graduacoes (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references usuarios (id),
  academia_id       uuid not null references academias (id),
  faixa_slug        varchar(50) not null references faixas (slug),
  grau              integer,
  data_graduacao    date not null,
  professor_id      uuid references usuarios (id),
  observacoes       text,
  criado_em         timestamptz not null default now()
);

-- ============================================
-- 6) ÍNDICES
-- ============================================

create index if not exists idx_usuarios_email on usuarios (email);
create index if not exists idx_usuarios_faixa on usuarios (faixa_atual_slug);
create index if not exists idx_presencas_aluno_status on presencas (aluno_id, status);
create index if not exists idx_aulas_data_academia on aulas (academia_id, data_inicio);
create index if not exists idx_matriculas_usuario_academia on matriculas (usuario_id, academia_id);
create index if not exists idx_convites_token_otp on convites (token_hash, otp_code) where used_at is null;
create index if not exists idx_convites_expires on convites (expires_at) where used_at is null;
create index if not exists idx_refresh_tokens_hash on refresh_tokens (token_hash) where revoked_at is null;
create index if not exists idx_password_reset_valid on password_reset_tokens (usuario_id, codigo_hash) where used_at is null;

-- ============================================
-- FIM DO SCRIPT
-- ============================================

-- Para popular com dados de demonstração:
-- \i 003-seed-faixas-e-regras-base.sql
-- \i 002-seed-demo-completa.sql

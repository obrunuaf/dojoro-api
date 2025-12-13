-- Auditoria de decisao de presencas
-- Cria colunas de auditoria, FK, trigger de updated_at e backfill leve.

-- 1) Colunas de auditoria e updated_at
alter table presencas
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists decidido_em timestamptz,
  add column if not exists decidido_por uuid,
  add column if not exists decisao_observacao text;

-- 2) FK decidido_por -> usuarios(id)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'presencas_decidido_por_fkey'
      and conrelid = 'public.presencas'::regclass
  ) then
    alter table presencas
      add constraint presencas_decidido_por_fkey
      foreign key (decidido_por) references usuarios (id)
      on delete set null;
  end if;
end$$;

-- 3) Function para updated_at (fora do DO)
create or replace function public.presencas_set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists trg_presencas_set_updated_at on public.presencas;

create trigger trg_presencas_set_updated_at
before update on public.presencas
for each row
execute function public.presencas_set_updated_at();

-- 4) Backfill leve de updated_at
update presencas
   set updated_at = coalesce(updated_at, criado_em)
 where updated_at is null;

-- =======================
-- Como aplicar (DEV/CI):
-- =======================
-- psql "$DATABASE_URL" -f sql/003-presencas-auditoria-decisao.sql

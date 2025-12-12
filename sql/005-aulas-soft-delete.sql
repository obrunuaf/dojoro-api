-- Migration: adicionar soft-delete em aulas
alter table aulas
  add column if not exists deleted_at timestamptz;

create index if not exists idx_aulas_deleted_at
  on aulas (deleted_at);

create index if not exists idx_aulas_turma_data
  on aulas (turma_id, data_inicio);

-- Migracion incremental: correr esto en Supabase (SQL Editor) si ya
-- ejecutaste schema.sql antes y solo necesitas agregar las tablas nuevas
-- (feriados y notas_semanales).
create table if not exists feriados (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  descripcion text,
  creado_en timestamptz not null default now()
);
alter table feriados enable row level security;

create table if not exists notas_semanales (
  fecha_inicio date primary key,
  texto text not null default '',
  actualizado_en timestamptz not null default now()
);
alter table notas_semanales enable row level security;

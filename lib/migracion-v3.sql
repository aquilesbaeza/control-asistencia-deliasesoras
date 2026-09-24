-- Migracion v3: correr UNA VEZ en Supabase (SQL Editor > New query > pegar todo > Run).
-- Es seguro correrla otra vez: no duplica nada.

-- 1) Meses en los que Nuria ya indico sus feriados (o que no hay ninguno).
create table if not exists feriados_confirmados (
  mes text primary key, -- formato YYYY-MM
  creado_en timestamptz not null default now()
);
alter table feriados_confirmados enable row level security;

-- 2) Horario de entrada y fechas de ingreso/baja de cada asesora.
alter table asesoras add column if not exists hora_entrada time;
alter table asesoras add column if not exists fecha_ingreso date;
alter table asesoras add column if not exists fecha_baja date;

-- Fechas segun el listado actual de la supervisora (setiembre 2026).
update asesoras set fecha_ingreso = '2026-09-16' where nombre like 'EVANY MICHELLE%' and fecha_ingreso is null;
update asesoras set fecha_ingreso = '2026-09-11' where nombre like 'MARIA FERNANDA CAMPOS%' and fecha_ingreso is null;
update asesoras set fecha_ingreso = '2026-08-03' where nombre like 'LUISA ARCIA%' and fecha_ingreso is null;
update asesoras set fecha_baja = '2026-09-04' where nombre like 'OWEN MONTIEL%' and fecha_baja is null;
update asesoras set fecha_baja = '2026-09-02' where nombre like 'SHIRLEY VANESSA%' and fecha_baja is null;

-- 3) Comentarios estructurados: asunto + asesora + situacion (se manejan dia a dia).
create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  asunto text not null,
  asesora_id uuid references asesoras(id) on delete set null,
  situacion text not null default '',
  creado_en timestamptz not null default now()
);
create index if not exists comentarios_fecha_idx on comentarios (fecha);
alter table comentarios enable row level security;

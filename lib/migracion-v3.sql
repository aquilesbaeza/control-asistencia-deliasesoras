-- Migracion v3: correr una vez en Supabase (SQL Editor > New query > Run).

-- Meses en los que Nuria ya indico sus feriados (o que no hay ninguno).
create table if not exists feriados_confirmados (
  mes text primary key, -- formato YYYY-MM
  creado_en timestamptz not null default now()
);
alter table feriados_confirmados enable row level security;

-- Horario de entrada de cada asesora (lo define Nuria). Sirve para avisar
-- "aun sin marca de entrada" y calcular cuando termina su jornada.
alter table asesoras add column if not exists hora_entrada time;

-- Comentarios estructurados: asunto + asesora + situacion (reemplazan el texto libre por semana).
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

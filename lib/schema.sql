-- Ejecutar una sola vez en Supabase: SQL Editor > New query > pegar todo > Run.
create extension if not exists "pgcrypto";

create table if not exists asesoras (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  punto text not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table if not exists marcas (
  id uuid primary key default gen_random_uuid(),
  asesora_id uuid not null references asesoras(id) on delete cascade,
  fecha date not null,
  hora time not null,
  tipo text not null check (tipo in ('entrada', 'salida')),
  foto_url text,
  origen text not null default 'ocr' check (origen in ('ocr', 'manual')),
  creado_en timestamptz not null default now()
);
create index if not exists marcas_asesora_fecha_idx on marcas (asesora_id, fecha);

create table if not exists dias_especiales (
  id uuid primary key default gen_random_uuid(),
  asesora_id uuid not null references asesoras(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('ausencia', 'incapacidad', 'libre', 'vacaciones')),
  nota text,
  creado_en timestamptz not null default now(),
  unique (asesora_id, fecha)
);

-- Dias feriados del mes que Nuria define de antemano. Un feriado se trabaja
-- de forma opcional: quien no tenga marca ese dia NO cuenta como ausencia.
create table if not exists feriados (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  descripcion text,
  creado_en timestamptz not null default now()
);

-- Meses en los que Nuria ya indico sus feriados (o que no hay ninguno).
create table if not exists feriados_confirmados (
  mes text primary key,
  creado_en timestamptz not null default now()
);

-- Horario de entrada por asesora (lo define Nuria).
alter table asesoras add column if not exists hora_entrada time;
alter table asesoras add column if not exists fecha_ingreso date;
alter table asesoras add column if not exists fecha_baja date;

-- Comentarios libres por semana (igual al formato en papel de Nuria: vacaciones,
-- incapacidades, ausencias, renuncias, nuevo ingreso, feriados trabajados, etc.)
create table if not exists notas_semanales (
  fecha_inicio date primary key, -- lunes de esa semana
  texto text not null default '',
  actualizado_en timestamptz not null default now()
);

create table if not exists configuracion (
  id int primary key default 1,
  horas_efectivas numeric not null default 8,
  minutos_almuerzo int not null default 60,
  hora_entrada_estandar time not null default '08:00',
  hora_salida_estandar time not null default '17:00',
  check (id = 1)
);
insert into configuracion (id) values (1) on conflict (id) do nothing;

-- Bucket de storage para respaldar las fotos originales (crear tambien desde
-- Storage > New bucket > nombre "marcas-fotos" > Public: no).

-- Comentarios estructurados: asunto + asesora + situacion.
create table if not exists comentarios (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  asunto text not null,
  asesora_id uuid references asesoras(id) on delete set null,
  situacion text not null default '',
  creado_en timestamptz not null default now()
);
create index if not exists comentarios_fecha_idx on comentarios (fecha);

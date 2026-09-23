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

-- Migracion v4: correr UNA VEZ en Supabase (SQL Editor > New query > pegar todo > Run).
-- Permite que Nuria corrija la hora de entrada/salida guardando la hora original y el motivo.
alter table marcas add column if not exists hora_original time;
alter table marcas add column if not exists motivo_correccion text;

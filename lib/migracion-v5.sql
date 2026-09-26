-- Migracion v5: correr UNA VEZ en Supabase (SQL Editor > New query > pegar todo > Run).
-- Guarda la foto del comprobante de incapacidad (para consultarla despues), no solo el codigo leido.

alter table dias_especiales add column if not exists comprobante_url text;

-- Bucket publico para las fotos de comprobantes (la API sube con la service role key, sin RLS de por medio).
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;

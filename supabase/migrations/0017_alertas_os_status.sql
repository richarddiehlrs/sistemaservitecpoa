-- Preferência separada para mudanças de status da OS
-- Rode no SQL Editor do Supabase APÓS 0016.

alter table public.preferencias_alertas
  add column if not exists os_status boolean not null default true;

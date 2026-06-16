-- Alertas ocultados pelo usuário (botão "Limpar alertas" no sino)
alter table public.preferencias_alertas
  add column if not exists alertas_dispensados jsonb not null default '[]'::jsonb;

comment on column public.preferencias_alertas.alertas_dispensados is
  'Lista de alertas operacionais dispensados pelo usuário [{ref_tipo, ref_id, dispensado_em}].';

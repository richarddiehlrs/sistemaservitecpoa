-- ServitecPoa ERP - Tipo de atendimento (domicílio / oficina) para painel
alter table public.ordens_servico
  add column if not exists tipo_atendimento text not null default 'domicilio'
    check (tipo_atendimento in ('domicilio', 'oficina'));

create index if not exists idx_os_tipo_atendimento on public.ordens_servico (tipo_atendimento);

comment on column public.ordens_servico.tipo_atendimento is
  'domicilio = visita no cliente; oficina = equipamento na bancada';

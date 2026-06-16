-- Valor do orçamento no momento da aprovação (detecta alteração posterior)

alter table public.ordens_servico
  add column if not exists valor_aprovado numeric(12,2);

update public.ordens_servico
set valor_aprovado = valor_total
where aprovado = true and valor_aprovado is null and valor_total > 0;

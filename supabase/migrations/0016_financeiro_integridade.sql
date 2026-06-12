-- Integridade financeira: anti-duplicação, views atualizadas, consistência status/valor_pago
-- Rode no SQL Editor do Supabase APÓS 0015.

-- Impede duas receitas ativas para a mesma OS
create unique index if not exists idx_lanc_os_receita_ativa
  on public.lancamentos_financeiros (os_id)
  where os_id is not null and tipo = 'receita' and status <> 'cancelado';

-- View de fluxo de caixa alinhada ao app (valor_pago + parcial)
create or replace view public.vw_fluxo_caixa as
select
  date_trunc('month', l.data_pagamento)::date as mes,
  l.tipo,
  sum(l.valor_pago) as total
from public.lancamentos_financeiros l
where l.status in ('pago', 'parcial')
  and l.valor_pago > 0
  and l.data_pagamento is not null
group by 1, 2;

-- View DRE com juros e multa na receita
create or replace view public.vw_dre as
select
  date_trunc('month', l.data_competencia)::date as mes,
  c.grupo_dre,
  l.tipo,
  sum(l.valor + coalesce(l.juros, 0) + coalesce(l.multa, 0)) as total
from public.lancamentos_financeiros l
left join public.categorias_financeiras c on c.id = l.categoria_id
where l.status <> 'cancelado'
group by 1, 2, 3;

-- Garantir valor_pago em lançamentos quitados
update public.lancamentos_financeiros
  set valor_pago = valor + coalesce(juros, 0) + coalesce(multa, 0),
      valor_liquido = coalesce(valor_liquido, valor - coalesce(taxa_cartao, 0))
  where status = 'pago' and coalesce(valor_pago, 0) = 0;

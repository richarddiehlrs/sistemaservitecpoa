-- =====================================================================
-- 0039 — Despesas de campo pelo celular (app do técnico)
--  * despesa já entra PAGA, na conta escolhida (vai para o livro de
--    pagamentos e para a conciliação bancária)
--  * foto do comprovante (bucket privado "comprovantes")
--  * km do veículo e litros (combustível) para custo por km
--  * id_cliente: código gerado no celular → reenvio offline não duplica
-- Rode no SQL Editor do Supabase APÓS 0038.
-- =====================================================================

alter table public.lancamentos_financeiros
  add column if not exists comprovante_path text,
  add column if not exists km_veiculo integer check (km_veiculo is null or km_veiculo >= 0),
  add column if not exists litros numeric(8,2) check (litros is null or litros > 0),
  add column if not exists id_cliente uuid;

create unique index if not exists idx_lanc_id_cliente
  on public.lancamentos_financeiros (id_cliente)
  where id_cliente is not null;

comment on column public.lancamentos_financeiros.id_cliente is
  'Identificador gerado no celular para o envio offline não duplicar o lançamento.';

-- Categorias usadas pelo app (cria só as que faltam)
insert into public.categorias_financeiras (nome, tipo, grupo_dre)
select v.nome, 'despesa', v.grupo
from (values
  ('Combustível / deslocamento', 'despesa_operacional'),
  ('Compra de peças', 'custo_pecas'),
  ('Alimentação / refeição', 'despesa_operacional'),
  ('Estacionamento / pedágio', 'despesa_operacional'),
  ('Ferramentas / equipamentos', 'despesa_operacional'),
  ('Despesas de campo (técnico)', 'despesa_operacional')
) as v(nome, grupo)
where not exists (
  select 1 from public.categorias_financeiras c where c.nome = v.nome and c.tipo = 'despesa'
);

-- ---------------------------------------------------------------------
-- Bucket privado de comprovantes: pasta = id do usuário
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do update set public = false;

drop policy if exists "comprovantes insert proprio" on storage.objects;
create policy "comprovantes insert proprio" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'comprovantes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "comprovantes ler" on storage.objects;
create policy "comprovantes ler" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'comprovantes'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.pode_financeiro())
  );

drop policy if exists "comprovantes apagar" on storage.objects;
create policy "comprovantes apagar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'comprovantes'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.pode_financeiro())
  );

-- ---------------------------------------------------------------------
-- RPC: lança a despesa já paga (lançamento + pagamento, numa transação)
-- ---------------------------------------------------------------------
create or replace function public.lancar_despesa_campo(
  p_id_cliente uuid,
  p_categoria text,
  p_valor numeric,
  p_data date default null,
  p_conta_id uuid default null,
  p_forma text default null,
  p_os_id uuid default null,
  p_descricao text default null,
  p_km integer default null,
  p_litros numeric default null,
  p_comprovante_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil record;
  v_id uuid;
  v_hoje date := (timezone('America/Sao_Paulo', now()))::date;
  v_data date := coalesce(p_data, v_hoje);
  v_cat_nome text;
  v_cat_id uuid;
  v_rotulo text;
  v_desc text;
  v_conta uuid;
begin
  select id, papel, ativo, coalesce(nullif(trim(nome), ''), split_part(email, '@', 1)) as nome
    into v_perfil
  from public.profiles where id = auth.uid();

  if v_perfil.id is null or not v_perfil.ativo or v_perfil.papel not in ('admin', 'atendente', 'tecnico') then
    raise exception 'Sem permissão para lançar despesas.';
  end if;

  -- Reenvio do celular (fila offline): devolve o lançamento já criado
  if p_id_cliente is not null then
    select id into v_id from public.lancamentos_financeiros where id_cliente = p_id_cliente;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  if coalesce(p_valor, 0) <= 0 then
    raise exception 'Informe um valor maior que zero.';
  end if;
  if v_data > v_hoje then
    raise exception 'A data da despesa não pode ser no futuro.';
  end if;
  if p_os_id is not null and v_perfil.papel = 'tecnico' and not public.os_do_tecnico(p_os_id) then
    raise exception 'Esta OS não está atribuída a você.';
  end if;

  select case p_categoria
           when 'combustivel' then 'Combustível / deslocamento'
           when 'pecas' then 'Compra de peças'
           when 'alimentacao' then 'Alimentação / refeição'
           when 'estacionamento' then 'Estacionamento / pedágio'
           when 'ferramenta' then 'Ferramentas / equipamentos'
           else 'Despesas de campo (técnico)'
         end,
         case p_categoria
           when 'combustivel' then 'Combustível'
           when 'pecas' then 'Peças / material'
           when 'alimentacao' then 'Alimentação'
           when 'estacionamento' then 'Estacionamento / pedágio'
           when 'ferramenta' then 'Ferramentas'
           else 'Despesa de campo'
         end
    into v_cat_nome, v_rotulo;

  select id into v_cat_id
  from public.categorias_financeiras
  where nome = v_cat_nome and tipo = 'despesa'
  limit 1;

  v_desc := v_rotulo || coalesce(' — ' || nullif(trim(p_descricao), ''), '');

  -- Conta de onde o dinheiro saiu: a escolhida; senão pela forma, sem usar
  -- a maquininha (ela só recebe); senão o primeiro banco ativo.
  if p_conta_id is null then
    select c.id into v_conta
    from public.contas_financeiras c
    where c.ativo and c.tipo <> 'maquininha'
      and nullif(trim(p_forma), '') = any (c.formas_padrao)
    order by c.created_at
    limit 1;
    if v_conta is null then
      select c.id into v_conta
      from public.contas_financeiras c
      where c.ativo and c.tipo = 'banco'
      order by c.created_at
      limit 1;
    end if;
  else
    v_conta := p_conta_id;
  end if;

  insert into public.lancamentos_financeiros (
    tipo, descricao, categoria_id, os_id, tecnico, criado_por, origem,
    valor, valor_pago, data_competencia, data_vencimento, status,
    forma_pagamento, observacoes, comprovante_path, km_veiculo, litros, id_cliente
  ) values (
    'despesa', v_desc, v_cat_id, p_os_id, v_perfil.nome, v_perfil.id, 'campo',
    round(p_valor, 2), 0, v_data, v_data, 'pendente',
    nullif(trim(p_forma), ''), nullif(trim(p_descricao), ''),
    nullif(trim(p_comprovante_path), ''), p_km,
    case when p_litros > 0 then round(p_litros, 2) end,
    p_id_cliente
  )
  returning id into v_id;

  -- Pagamento: a despesa já foi paga no ato (sem reembolso)
  insert into public.os_pagamentos (
    os_id, lancamento_id, tipo, valor, data_pagamento, forma_pagamento, conta_id, observacao, registrado_por
  ) values (
    p_os_id, v_id, 'baixa', round(p_valor, 2), v_data, nullif(trim(p_forma), ''), v_conta,
    'Despesa de campo paga no ato', v_perfil.id
  );

  return v_id;
end;
$$;

grant execute on function public.lancar_despesa_campo(uuid, text, numeric, date, uuid, text, uuid, text, integer, numeric, text) to authenticated;

-- Excluir despesa de campo: quem lançou (no mesmo dia) ou o financeiro
create or replace function public.excluir_despesa_campo(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_l record;
begin
  select id, criado_por, origem, created_at, comprovante_path into v_l
  from public.lancamentos_financeiros where id = p_id;

  if v_l.id is null or v_l.origem <> 'campo' then
    raise exception 'Despesa de campo não encontrada.';
  end if;
  if not public.pode_financeiro()
     and not (v_l.criado_por = auth.uid()
              and (timezone('America/Sao_Paulo', v_l.created_at))::date = (timezone('America/Sao_Paulo', now()))::date)
  then
    raise exception 'Você só pode excluir despesas lançadas hoje. Peça ao financeiro.';
  end if;
  if exists (select 1 from public.os_pagamentos where lancamento_id = p_id and extrato_transacao_id is not null) then
    raise exception 'Despesa já conciliada com o extrato bancário. Desfaça a conciliação antes.';
  end if;

  delete from public.os_pagamentos where lancamento_id = p_id;
  delete from public.lancamentos_financeiros where id = p_id;
  return v_l.comprovante_path;
end;
$$;

grant execute on function public.excluir_despesa_campo(uuid) to authenticated;

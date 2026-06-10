-- =====================================================================
-- ServitecPoa ERP - Push PWA + portal com histórico/timeline
-- Rode no SQL Editor do Supabase APÓS 0011.
-- =====================================================================

-- Inscrições Web Push (técnicos recebem nova OS no celular)
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);

create trigger trg_push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Portal: histórico da OS + turno da visita
create or replace function public.os_publica(p_token uuid)
returns json
language sql
security definer set search_path = public
stable
as $$
  select json_build_object(
    'numero', o.numero,
    'status', o.status,
    'defeito', o.defeito_relatado,
    'diagnostico', o.diagnostico,
    'servico', o.servico_executado,
    'valor_itens', o.valor_itens,
    'valor_visita', o.valor_visita,
    'abater_visita', o.abater_visita,
    'desconto', o.desconto,
    'acrescimo', o.acrescimo,
    'valor_total', o.valor_total,
    'garantia_dias', o.garantia_dias,
    'data_abertura', o.data_abertura,
    'data_previsao', o.data_previsao,
    'turno', o.turno,
    'aprovado', o.aprovado,
    'data_aprovacao', o.data_aprovacao,
    'tecnico', o.tecnico,
    'assinatura_tecnico', o.assinatura_tecnico,
    'observacao_cliente_ausente', o.observacao_cliente_ausente,
    'cliente_ausente_registrado_at', o.cliente_ausente_registrado_at,
    'cliente_nome', c.nome,
    'equipamento', trim(coalesce(e.tipo,'') || ' ' || coalesce(e.marca,'') || ' ' || coalesce(e.modelo,'')),
    'historico', (
      select coalesce(json_agg(json_build_object(
        'status', h.status,
        'observacao', h.observacao,
        'created_at', h.created_at
      ) order by h.created_at), '[]'::json)
      from public.os_status_historico h where h.os_id = o.id
    ),
    'itens', (
      select coalesce(json_agg(json_build_object(
        'descricao', i.descricao, 'tipo', i.tipo,
        'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario, 'subtotal', i.subtotal
      ) order by i.created_at), '[]'::json)
      from public.os_itens i where i.os_id = o.id
    ),
    'anexos_ausente', (
      select coalesce(json_agg(json_build_object(
        'url', a.url, 'descricao', a.descricao
      ) order by a.created_at), '[]'::json)
      from public.os_anexos a where a.os_id = o.id and a.momento = 'cliente_ausente'
    ),
    'empresa', (select json_build_object(
        'nome', cfg.nome, 'telefone', cfg.telefone, 'email', cfg.email,
        'logo_url', cfg.logo_url, 'termo_garantia', cfg.termo_garantia
      ) from public.configuracoes cfg where cfg.id = 1)
  )
  from public.ordens_servico o
  join public.clientes c on c.id = o.cliente_id
  left join public.equipamentos e on e.id = o.equipamento_id
  where o.aprovacao_token = p_token;
$$;

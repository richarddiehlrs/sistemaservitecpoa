-- =====================================================================
-- ServitecPoa ERP - Integração tecnico_id (agenda, backfill, portal)
-- Rode no SQL Editor do Supabase APÓS 0010.
-- =====================================================================

-- Vínculo técnico na agenda
alter table public.agendamentos
  add column if not exists tecnico_id uuid references public.profiles(id) on delete set null;

create index if not exists idx_agendamentos_tecnico_id on public.agendamentos (tecnico_id);

-- Backfill ordens_servico.tecnico_id a partir do nome legado
update public.ordens_servico o
set tecnico_id = p.id
from public.profiles p
where o.tecnico_id is null
  and o.tecnico is not null
  and p.papel = 'tecnico'
  and p.ativo = true
  and lower(trim(p.nome)) = lower(trim(o.tecnico));

-- Backfill agendamentos.tecnico_id a partir do nome legado
update public.agendamentos a
set tecnico_id = p.id
from public.profiles p
where a.tecnico_id is null
  and a.tecnico is not null
  and p.papel = 'tecnico'
  and p.ativo = true
  and lower(trim(p.nome)) = lower(trim(a.tecnico));

-- Portal público: incluir técnico, cliente ausente e fotos comprobatórias
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
    'aprovado', o.aprovado,
    'data_aprovacao', o.data_aprovacao,
    'tecnico', o.tecnico,
    'assinatura_tecnico', o.assinatura_tecnico,
    'observacao_cliente_ausente', o.observacao_cliente_ausente,
    'cliente_ausente_registrado_at', o.cliente_ausente_registrado_at,
    'cliente_nome', c.nome,
    'equipamento', trim(coalesce(e.tipo,'') || ' ' || coalesce(e.marca,'') || ' ' || coalesce(e.modelo,'')),
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

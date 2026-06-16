-- NPS pós-serviço no portal + próximo agendamento na OS pública

create table if not exists public.os_nps (
  id            uuid primary key default gen_random_uuid(),
  os_id         uuid not null references public.ordens_servico(id) on delete cascade,
  nota          smallint not null check (nota between 1 and 5),
  comentario    text,
  created_at    timestamptz not null default now(),
  unique (os_id)
);

create index if not exists idx_os_nps_os on public.os_nps (os_id);

alter table public.os_nps enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'os_nps' and policyname = 'os_nps_autenticado'
  ) then
    create policy os_nps_autenticado on public.os_nps
      for select using (auth.role() = 'authenticated');
  end if;
end $$;

create or replace function public.registrar_nps_portal(
  p_token uuid,
  p_nota int,
  p_comentario text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_os_id uuid;
begin
  if p_nota is null or p_nota < 1 or p_nota > 5 then
    return json_build_object('ok', false, 'erro', 'Nota inválida.');
  end if;

  select id into v_os_id
  from public.ordens_servico
  where aprovacao_token = p_token;

  if v_os_id is null then
    return json_build_object('ok', false, 'erro', 'OS não encontrada.');
  end if;

  insert into public.os_nps (os_id, nota, comentario)
  values (v_os_id, p_nota, nullif(trim(p_comentario), ''))
  on conflict (os_id) do update
    set nota = excluded.nota,
        comentario = excluded.comentario,
        created_at = now();

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.registrar_nps_portal(uuid, int, text) to anon, authenticated;

-- Portal público: inclui próximo agendamento e NPS
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
    'acompanha', o.acompanha,
    'estado_aparelho', o.estado_aparelho,
    'assinatura_cliente', o.assinatura_cliente,
    'assinatura_tecnico', o.assinatura_tecnico,
    'observacao_cliente_ausente', o.observacao_cliente_ausente,
    'cliente_ausente_registrado_at', o.cliente_ausente_registrado_at,
    'cliente_nome', c.nome,
    'equipamento', coalesce(
      (
        select string_agg(
          trim(coalesce(e2.tipo,'') || ' ' || coalesce(e2.marca,'') || ' ' || coalesce(e2.modelo,'')),
          ' • ' order by oe.ordem
        )
        from public.os_equipamentos oe
        join public.equipamentos e2 on e2.id = oe.equipamento_id
        where oe.os_id = o.id
      ),
      trim(coalesce(e.tipo,'') || ' ' || coalesce(e.marca,'') || ' ' || coalesce(e.modelo,''))
    ),
    'equipamentos', coalesce(
      (
        select json_agg(json_build_object(
          'tipo', e2.tipo,
          'marca', e2.marca,
          'modelo', e2.modelo,
          'numero_serie', e2.numero_serie,
          'voltagem', e2.voltagem,
          'cor', e2.cor
        ) order by oe.ordem)
        from public.os_equipamentos oe
        join public.equipamentos e2 on e2.id = oe.equipamento_id
        where oe.os_id = o.id
      ),
      case when e.id is not null then json_build_array(json_build_object(
        'tipo', e.tipo,
        'marca', e.marca,
        'modelo', e.modelo,
        'numero_serie', e.numero_serie,
        'voltagem', e.voltagem,
        'cor', e.cor
      )) else '[]'::json end
    ),
    'cliente', json_build_object(
      'nome', c.nome,
      'cpf_cnpj', c.cpf_cnpj,
      'telefone', c.telefone,
      'logradouro', c.logradouro,
      'numero', c.numero,
      'complemento', c.complemento,
      'bairro', c.bairro,
      'cidade', c.cidade,
      'uf', c.uf,
      'cep', c.cep
    ),
    'equipamento_detalhe', case when e.id is not null then json_build_object(
      'tipo', e.tipo,
      'marca', e.marca,
      'modelo', e.modelo,
      'numero_serie', e.numero_serie,
      'voltagem', e.voltagem,
      'cor', e.cor
    ) else null end,
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
    'proximo_agendamento', (
      select json_build_object(
        'data', a.data,
        'hora_inicio', a.hora_inicio,
        'hora_fim', a.hora_fim,
        'turno', a.turno,
        'status', a.status,
        'endereco', a.endereco
      )
      from public.agendamentos a
      where a.os_id = o.id
        and a.status in ('agendado', 'confirmado')
        and a.data >= current_date
      order by a.data asc, a.hora_inicio asc nulls last
      limit 1
    ),
    'nps', (
      select json_build_object(
        'nota', n.nota,
        'comentario', n.comentario,
        'created_at', n.created_at
      )
      from public.os_nps n
      where n.os_id = o.id
    ),
    'empresa', (select json_build_object(
        'nome', cfg.nome, 'cnpj', cfg.cnpj, 'telefone', cfg.telefone, 'email', cfg.email,
        'endereco', cfg.endereco, 'cidade', cfg.cidade,
        'logo_url', cfg.logo_url, 'termo_garantia', cfg.termo_garantia,
        'politica_os', cfg.politica_os
      ) from public.configuracoes cfg where cfg.id = 1)
  )
  from public.ordens_servico o
  join public.clientes c on c.id = o.cliente_id
  left join public.equipamentos e on e.id = o.equipamento_id
  where o.aprovacao_token = p_token;
$$;

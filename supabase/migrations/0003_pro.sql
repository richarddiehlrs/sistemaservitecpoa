-- =====================================================================
-- ServitecPoa ERP - Recursos profissionais
-- Rode no SQL Editor do Supabase APÓS 0001 e 0002.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CONFIGURAÇÕES DA EMPRESA (linha única)
-- ---------------------------------------------------------------------
create table if not exists public.configuracoes (
  id              smallint primary key default 1 check (id = 1),
  nome            text not null default 'ServitecPoa Assistência Técnica',
  cnpj            text,
  telefone        text,
  email           text,
  endereco        text,
  cidade          text,
  logo_url        text,
  termo_garantia  text default 'Garantia de 90 dias sobre o serviço executado e peças substituídas, conforme art. 26 do CDC. A garantia não cobre mau uso, quedas, oscilações de energia ou violação por terceiros.',
  politica_os     text default 'A visita técnica é cobrada e abatida do valor total caso o serviço seja aprovado e executado. Equipamentos não retirados em 90 dias após o aviso poderão ser cobrados por armazenagem.',
  msg_whatsapp    text default 'Olá! Aqui é da {empresa}. Sobre sua OS {os}: status atualizado para "{status}".',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_config_updated_at
  before update on public.configuracoes
  for each row execute function public.set_updated_at();

insert into public.configuracoes (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- PERFIS DE USUÁRIO (papéis)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  email       text,
  papel       text not null default 'atendente' check (papel in ('admin','atendente','tecnico')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cria automaticamente um profile quando um usuário é criado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome, papel)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    -- primeiro usuário do sistema vira admin
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'atendente' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garante profile (admin) para usuários já existentes
insert into public.profiles (id, email, nome, papel)
select u.id, u.email, split_part(u.email, '@', 1), 'admin'
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- CATÁLOGO DE SERVIÇOS / TABELA DE PREÇOS
-- ---------------------------------------------------------------------
create table if not exists public.servicos_catalogo (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  tipo        text not null default 'servico' check (tipo in ('servico','peca')),
  valor       numeric(12,2) not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_servicos_updated_at
  before update on public.servicos_catalogo
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- ORDENS DE SERVIÇO: aprovação online + assinatura
-- ---------------------------------------------------------------------
alter table public.ordens_servico
  add column if not exists aprovacao_token uuid not null default gen_random_uuid(),
  add column if not exists aprovado boolean not null default false,
  add column if not exists data_aprovacao timestamptz,
  add column if not exists assinatura_cliente text,
  add column if not exists observacao_aprovacao text;

create unique index if not exists idx_os_token on public.ordens_servico (aprovacao_token);

-- ---------------------------------------------------------------------
-- ANEXOS / FOTOS DA OS
-- ---------------------------------------------------------------------
create table if not exists public.os_anexos (
  id          uuid primary key default gen_random_uuid(),
  os_id       uuid not null references public.ordens_servico(id) on delete cascade,
  url         text not null,
  path        text,
  descricao   text,
  momento     text default 'antes' check (momento in ('antes','depois','outro')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_anexos_os on public.os_anexos (os_id);

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.configuracoes      enable row level security;
alter table public.profiles           enable row level security;
alter table public.servicos_catalogo  enable row level security;
alter table public.os_anexos          enable row level security;

-- Função auxiliar: o usuário atual é admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.papel = 'admin'
  );
$$;

-- Configurações: todos autenticados leem; somente admin altera.
drop policy if exists cfg_select on public.configuracoes;
drop policy if exists cfg_write on public.configuracoes;
create policy cfg_select on public.configuracoes for select to authenticated using (true);
create policy cfg_write  on public.configuracoes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Profiles: usuário lê o próprio; admin lê/edita todos.
drop policy if exists prof_select_self on public.profiles;
drop policy if exists prof_admin_all on public.profiles;
create policy prof_select_self on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy prof_admin_all on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Catálogo: todos leem; admin gerencia.
drop policy if exists cat_select on public.servicos_catalogo;
drop policy if exists cat_write on public.servicos_catalogo;
create policy cat_select on public.servicos_catalogo for select to authenticated using (true);
create policy cat_write  on public.servicos_catalogo for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Anexos: acesso total para autenticados.
drop policy if exists anexos_all on public.os_anexos;
create policy anexos_all on public.os_anexos for all to authenticated using (true) with check (true);

-- =====================================================================
-- GRANTS
-- =====================================================================
grant select, insert, update, delete on
  public.configuracoes, public.profiles, public.servicos_catalogo, public.os_anexos
to authenticated;

-- =====================================================================
-- FUNÇÕES PÚBLICAS (portal do cliente) - sem necessidade de login
-- =====================================================================

-- Consulta pública da OS pelo token
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
    'cliente_nome', c.nome,
    'equipamento', trim(coalesce(e.tipo,'') || ' ' || coalesce(e.marca,'') || ' ' || coalesce(e.modelo,'')),
    'itens', (
      select coalesce(json_agg(json_build_object(
        'descricao', i.descricao, 'tipo', i.tipo,
        'quantidade', i.quantidade, 'valor_unitario', i.valor_unitario, 'subtotal', i.subtotal
      ) order by i.created_at), '[]'::json)
      from public.os_itens i where i.os_id = o.id
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

-- Aprovação do orçamento pelo cliente (com assinatura opcional)
create or replace function public.os_aprovar(p_token uuid, p_assinatura text default null, p_obs text default null)
returns json
language plpgsql
security definer set search_path = public
as $$
declare v_id uuid;
begin
  update public.ordens_servico
    set aprovado = true,
        data_aprovacao = now(),
        assinatura_cliente = coalesce(p_assinatura, assinatura_cliente),
        observacao_aprovacao = p_obs,
        status = case when status in ('aberta','em_analise','aguardando_aprovacao')
                      then 'aprovada' else status end
  where aprovacao_token = p_token
  returning id into v_id;

  if v_id is null then
    return json_build_object('ok', false, 'erro', 'OS não encontrada');
  end if;

  insert into public.os_status_historico (os_id, status, observacao)
  values (v_id, 'aprovada', 'Orçamento aprovado pelo cliente (portal)');

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.os_publica(uuid) to anon, authenticated;
grant execute on function public.os_aprovar(uuid, text, text) to anon, authenticated;

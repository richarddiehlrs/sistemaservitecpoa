import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, MapPin, Clock, Phone, Sun, Sunset, Wrench, CalendarCheck, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";
import { mapTecnicos } from "@/lib/tecnicos";
import { formatHora, formatNumeroOS, formatTelefone, hojeYmdLocal, ymdLocal, STATUS_AGENDAMENTO_LABEL, TIPO_AGENDAMENTO_LABEL, TIPO_AGENDAMENTO_COLOR } from "@/lib/format";
import { TURNOS } from "@/lib/turnos";
import { CheckinButtons } from "@/components/checkin-buttons";
import { ExcluirAgendamentoButton } from "@/components/excluir-agendamento-button";
import { TecnicosMapa, LinkMapaCheckin } from "@/components/tecnicos-mapa";
import { AgendaForm } from "@/components/agenda-form";
import { requireProfile } from "@/lib/auth-guard";
import { nomeTecnico, temPermissao } from "@/lib/permissoes";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";
import { resumoFinanceiroOs } from "@/lib/os-valores";
import { checkinAgendamento, checkoutAgendamento, criarAgendamento, excluirAgendamento } from "./actions";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return ymdLocal(d);
}
function inicioSemana(base: Date) {
  const d = new Date(base);
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDias(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function turnoDe(a: { turno?: string | null; hora_inicio?: string | null }): "manha" | "tarde" {
  if (a.turno === "tarde") return "tarde";
  if (a.turno === "manha" || a.turno === "dia") return "manha";
  if (a.hora_inicio && a.hora_inicio >= "13:00") return "tarde";
  return "manha";
}

function enderecoCliente(cli: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
} | null): string | undefined {
  if (!cli) return undefined;
  const s = [cli.logradouro, cli.numero, cli.complemento, cli.bairro, cli.cidade && `${cli.cidade}/${cli.uf ?? ""}`]
    .filter(Boolean)
    .join(", ");
  return s || undefined;
}

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; tecnico?: string }>;
}) {
  const { inicio, tecnico: filtroTecnico } = await searchParams;
  const baseDate = inicio ? new Date(inicio + "T00:00:00") : new Date();
  const segunda = inicioSemana(baseDate);
  const domingo = addDias(segunda, 6);
  const hojeStr = ymd(new Date());

  const profile = await requireProfile();
  const supabase = await createClient();
  let queryAgenda = supabase
    .from("agendamentos")
    .select("*, clientes(nome, telefone), ordens_servico(numero, status, valor_itens, valor_visita, abater_visita, desconto, acrescimo, motivo_atendimento)")
    .gte("data", ymd(segunda))
    .lte("data", ymd(domingo))
    .order("hora_inicio", { ascending: true });

  if (profile.papel === "tecnico") {
    const nome = nomeTecnico(profile);
    queryAgenda = queryAgenda.or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${nome}%`);
  } else if (filtroTecnico) {
    queryAgenda = queryAgenda.eq("tecnico_id", filtroTecnico);
  }

  const limiteGps = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const verGps = profile.papel !== "tecnico";
  const ehAdminOuAtendente = profile.papel === "admin" || profile.papel === "atendente";

  const podeCriarAgenda = ehAdminOuAtendente && temPermissao(profile.papel, "agenda_criar");

  const [{ data: agendamentos }, { data: posicoes }, { data: perfisTecnicos }, { data: osParaAgenda }] =
    await Promise.all([
    queryAgenda,
    verGps
      ? supabase
          .from("posicoes_tecnico")
          .select("*")
          .gte("atualizado_at", limiteGps)
          .order("atualizado_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    ehAdminOuAtendente
      ? supabase.from("profiles").select("*").eq("papel", "tecnico").eq("ativo", true).order("nome")
      : Promise.resolve({ data: [] as never[] }),
    podeCriarAgenda
      ? supabase
          .from("ordens_servico")
          .select(
            "id, numero, cliente_id, tecnico_id, tecnico, clientes(nome, logradouro, numero, complemento, bairro, cidade, uf)"
          )
          .eq("tipo_atendimento", "domicilio")
          .in("status", [...STATUS_OS_ABERTAS])
          .order("numero", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const tecnicos = mapTecnicos(perfisTecnicos || []);
  const podeCheckin = temPermissao(profile.papel, "agenda_checkin");
  const osOpcoes = (osParaAgenda || []).map((o) => {
    // @ts-expect-error relação
    const cli = o.clientes;
    return {
      id: o.id,
      label: `${formatNumeroOS(o.numero)} — ${cli?.nome || ""}`,
      cliente_id: o.cliente_id,
      tecnico_id: o.tecnico_id,
      tecnico: o.tecnico,
      endereco: enderecoCliente(cli),
    };
  });

  const semanaAnterior = ymd(addDias(segunda, -7));
  const proximaSemana = ymd(addDias(segunda, 7));
  const todos = agendamentos || [];

  const pendentes = todos.filter((a) => ["agendado", "confirmado"].includes(a.status));
  const emAtendimento = todos.filter((a) => a.status === "em_atendimento");
  const realizados = todos.filter((a) => a.status === "realizado");

  const periodoLabel = `${segunda.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${domingo.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div>
      <PageHeader
        title="Agenda de atendimentos"
        subtitle={`Semana de ${periodoLabel} — visitas criadas automaticamente ao abrir a OS • Manhã ${TURNOS.manha.inicio}–${TURNOS.manha.fim} · Tarde ${TURNOS.tarde.inicio}–${TURNOS.tarde.fim}`}
        action={
          ehAdminOuAtendente ? (
            <div className="flex flex-wrap gap-2">
              {podeCriarAgenda && (
                <AgendaForm
                  action={criarAgendamento}
                  dataPadrao={hojeStr}
                  tecnicos={tecnicos}
                  osOpcoes={osOpcoes}
                />
              )}
              <Link href="/manutencao" className="btn-secondary">
                Limpar órfãos
              </Link>
              <Link href="/ordens/nova" className="btn-primary">
                Nova OS (gera agenda)
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Pendentes" value={String(pendentes.length)} icon={<CalendarCheck className="h-5 w-5" />} tone="amber" />
        <StatCard title="Em atendimento" value={String(emAtendimento.length)} tone="blue" />
        <StatCard title="Realizados" value={String(realizados.length)} icon={<UserCheck className="h-5 w-5" />} tone="green" />
        <StatCard title="Total na semana" value={String(todos.length)} />
      </div>

      {ehAdminOuAtendente && tecnicos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Técnico:</span>
          <Link
            href={`/agenda?inicio=${ymd(segunda)}`}
            className={`badge ${!filtroTecnico ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            Todos
          </Link>
          {tecnicos.map((t) => (
            <Link
              key={t.id}
              href={`/agenda?inicio=${ymd(segunda)}&tecnico=${t.id}`}
              className={`badge ${filtroTecnico === t.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
            >
              {t.nome}
            </Link>
          ))}
        </div>
      )}

      {verGps && <TecnicosMapa posicoes={(posicoes || []) as never[]} />}

      <div className="mb-4 flex items-center gap-2">
        <Link href={`/agenda?inicio=${semanaAnterior}${filtroTecnico ? `&tecnico=${filtroTecnico}` : ""}`} className="btn-secondary">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Link>
        <Link href={`/agenda${filtroTecnico ? `?tecnico=${filtroTecnico}` : ""}`} className="btn-secondary">Hoje</Link>
        <Link href={`/agenda?inicio=${proximaSemana}${filtroTecnico ? `&tecnico=${filtroTecnico}` : ""}`} className="btn-secondary">
          Próxima <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        {DIAS.map((nomeDia, i) => {
          const dia = addDias(segunda, i);
          const dataStr = ymd(dia);
          const doDia = todos.filter((a) => a.data === dataStr);
          const manha = doDia.filter((a) => turnoDe(a) === "manha");
          const tarde = doDia.filter((a) => turnoDe(a) === "tarde");
          const ehHoje = dataStr === hojeStr;

          return (
            <div key={i} className={`card flex flex-col overflow-hidden ${ehHoje ? "ring-2 ring-brand-400" : ""}`}>
              <div className={`px-3 py-2 ${ehHoje ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                <p className="text-xs font-semibold uppercase">{nomeDia}</p>
                <p className="text-sm">{dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
              </div>

              <TurnoBloco titulo="Manhã" icone={<Sun className="h-3.5 w-3.5" />} itens={manha} podeCheckin={podeCheckin} podeExcluir={ehAdminOuAtendente} />
              <div className="border-t border-slate-100" />
              <TurnoBloco titulo="Tarde" icone={<Sunset className="h-3.5 w-3.5" />} itens={tarde} podeCheckin={podeCheckin} podeExcluir={ehAdminOuAtendente} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TurnoBloco({
  titulo,
  icone,
  itens,
  podeCheckin,
  podeExcluir,
}: {
  titulo: string;
  icone: ReactNode;
  itens: Array<Record<string, unknown>>;
  podeCheckin: boolean;
  podeExcluir: boolean;
}) {
  return (
    <div className="flex-1 p-2">
      <p className="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase text-slate-400">
        {icone} {titulo} {itens.length > 0 && <span className="text-slate-300">({itens.length})</span>}
      </p>
      <div className="space-y-2">
        {itens.length === 0 && <p className="px-1 py-1 text-center text-[11px] text-slate-300">—</p>}
        {itens.map((a) => (
          <CardAgendamento key={a.id as string} a={a} podeCheckin={podeCheckin} podeExcluir={podeExcluir} />
        ))}
      </div>
    </div>
  );
}

function CardAgendamento({
  a,
  podeCheckin,
  podeExcluir,
}: {
  a: Record<string, unknown>;
  podeCheckin: boolean;
  podeExcluir: boolean;
}) {
  const cli = a.clientes as { nome?: string; telefone?: string } | null;
  const os = a.ordens_servico as {
    numero?: number;
    status?: string;
    valor_itens?: number;
    valor_visita?: number;
    abater_visita?: boolean;
    desconto?: number;
    acrescimo?: number;
    motivo_atendimento?: string;
  } | null;
  const cancelado = a.status === "cancelado";
  const realizado = a.status === "realizado";
  const emAtendimento = a.status === "em_atendimento";
  const pendente = a.status === "agendado" || a.status === "confirmado";
  const vinculadoOs = Boolean(a.os_id);

  return (
    <div className={`rounded-lg border-l-4 p-2 text-xs ${TIPO_AGENDAMENTO_COLOR[a.tipo as string] || ""} ${cancelado ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold">{TIPO_AGENDAMENTO_LABEL[a.tipo as string] || String(a.tipo)}</span>
        <span className={`badge text-[9px] ${
          realizado ? "bg-green-100 text-green-700" :
          emAtendimento ? "bg-blue-100 text-blue-700" :
          pendente ? "bg-amber-100 text-amber-700" :
          cancelado ? "bg-red-100 text-red-600" :
          "bg-slate-100 text-slate-600"
        }`}>
          {STATUS_AGENDAMENTO_LABEL[a.status as string] || String(a.status)}
        </span>
      </div>

      {os?.numero && (
        <p className="mt-0.5 font-bold text-brand-700">{formatNumeroOS(os.numero)}</p>
      )}
      <p className="mt-0.5 font-medium text-slate-800">{String(a.titulo)}</p>
      {cli?.nome && <p className="text-slate-600">{cli.nome}</p>}
      {cli?.telefone && (
        <p className="flex items-center gap-0.5 text-slate-500">
          <Phone className="h-3 w-3" /> {formatTelefone(cli.telefone)}
        </p>
      )}
      {(a.hora_inicio || a.hora_fim) && (
        <p className="flex items-center gap-0.5 text-slate-500">
          <Clock className="h-3 w-3" />
          {formatHora(a.hora_inicio as string)}{a.hora_fim ? `–${formatHora(a.hora_fim as string)}` : ""}
        </p>
      )}
      {a.endereco && (
        <p className="flex items-start gap-0.5 text-slate-500">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {String(a.endereco)}
        </p>
      )}
      {a.tecnico && <p className="text-slate-400">Téc.: {String(a.tecnico)}</p>}

      {a.checkin_at && !realizado && (
        <p className="mt-0.5 text-[10px] text-green-600">
          Check-in {new Date(a.checkin_at as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          <LinkMapaCheckin lat={a.checkin_lat as number | null} lng={a.checkin_lng as number | null} />
        </p>
      )}

      {a.os_id && (
        <Link href={`/ordens/${a.os_id}`} className="mt-1 flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
          <Wrench className="h-3 w-3" /> Abrir ordem de serviço
        </Link>
      )}

      {podeCheckin && !cancelado && !realizado && (
        <div className="mt-1">
          <CheckinButtons
            agendamento={a as never}
            checkinAction={checkinAgendamento.bind(null, a.id as string)}
            checkoutAction={checkoutAgendamento.bind(null, a.id as string)}
            permitirRetorno={Boolean(a.os_id)}
            osResumo={
              os
                ? resumoFinanceiroOs({
                    valor_itens: Number(os.valor_itens) || 0,
                    valor_visita: Number(os.valor_visita) || 0,
                    abater_visita: Boolean(os.abater_visita),
                    desconto: Number(os.desconto) || 0,
                    acrescimo: Number(os.acrescimo) || 0,
                    motivo_atendimento: os.motivo_atendimento,
                  })
                : null
            }
          />
        </div>
      )}

      {vinculadoOs && pendente && (
        <p className="mt-1 text-[10px] text-slate-400">Gerado pela OS — edite data/técnico na ordem de serviço</p>
      )}

      {podeExcluir && (
        <ExcluirAgendamentoButton action={excluirAgendamento.bind(null, a.id as string)} />
      )}
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Check, X, MapPin, Clock, Phone, Sun, Sunset, Wrench } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { AgendaForm } from "@/components/agenda-form";
import { mapTecnicos } from "@/lib/tecnicos";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";
import { formatNumeroOS } from "@/lib/format";
import { CheckinButtons } from "@/components/checkin-buttons";
import {
  TIPO_AGENDAMENTO_LABEL,
  TIPO_AGENDAMENTO_COLOR,
  STATUS_AGENDAMENTO_LABEL,
  formatHora,
  formatTelefone,
} from "@/lib/format";
import { TURNOS } from "@/lib/turnos";
import { ConfirmButton } from "@/components/confirm-button";
import { TecnicosMapa, LinkMapaCheckin } from "@/components/tecnicos-mapa";
import { requireProfile } from "@/lib/auth-guard";
import { nomeTecnico, temPermissao } from "@/lib/permissoes";
import {
  criarAgendamento,
  alterarStatusAgendamento,
  excluirAgendamento,
  checkinAgendamento,
  checkoutAgendamento,
} from "./actions";

export const dynamic = "force-dynamic";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
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
function turnoDe(a: any): "manha" | "tarde" {
  if (a.turno === "tarde") return "tarde";
  if (a.turno === "manha" || a.turno === "dia") return "manha";
  if (a.hora_inicio && a.hora_inicio >= "13:00") return "tarde";
  return "manha";
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
    .select("*, clientes(nome, telefone)")
    .gte("data", ymd(segunda))
    .lte("data", ymd(domingo))
    .order("hora_inicio", { ascending: true });

  if (profile.papel === "tecnico") {
    const nome = nomeTecnico(profile);
    queryAgenda = queryAgenda.or(
      `tecnico_id.eq.${profile.id},tecnico.ilike.%${nome}%,tecnico.is.null`
    );
  } else if (filtroTecnico) {
    queryAgenda = queryAgenda.eq("tecnico_id", filtroTecnico);
  }

  const limiteGps = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const verGps = profile.papel !== "tecnico";
  const ehAdminOuAtendente = profile.papel === "admin" || profile.papel === "atendente";

  const [
    { data: agendamentos },
    { data: posicoes },
    { data: perfisTecnicos },
    { data: osAbertas },
  ] = await Promise.all([
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
    ehAdminOuAtendente
      ? supabase
          .from("ordens_servico")
          .select("id, numero, tecnico_id, tecnico, cliente_id, clientes(nome, logradouro, numero, bairro, cidade)")
          .in("status", [...STATUS_OS_ABERTAS])
          .order("data_abertura", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const tecnicos = mapTecnicos(perfisTecnicos || []);
  const osOpcoes = (osAbertas || []).map((o) => {
    // @ts-expect-error relação
    const c = o.clientes;
    const endereco = c
      ? [c.logradouro, c.numero, c.bairro, c.cidade].filter(Boolean).join(", ")
      : "";
    return {
      id: o.id,
      label: `${formatNumeroOS(o.numero)} — ${c?.nome || "Sem cliente"}`,
      cliente_id: o.cliente_id,
      tecnico_id: o.tecnico_id,
      tecnico: o.tecnico,
      endereco,
    };
  });

  const podeCriar = temPermissao(profile.papel, "agenda_criar");
  const podeCheckin = temPermissao(profile.papel, "agenda_checkin");

  const semanaAnterior = ymd(addDias(segunda, -7));
  const proximaSemana = ymd(addDias(segunda, 7));
  const todos = agendamentos || [];

  const periodoLabel = `${segunda.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} a ${domingo.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div>
      <PageHeader
        title="Agenda de atendimentos"
        subtitle={`Semana de ${periodoLabel} • Manhã ${TURNOS.manha.inicio}–${TURNOS.manha.fim} · Tarde ${TURNOS.tarde.inicio}–${TURNOS.tarde.fim}`}
        action={
          podeCriar ? (
            <AgendaForm
              action={criarAgendamento}
              dataPadrao={hojeStr}
              tecnicos={tecnicos}
              osOpcoes={osOpcoes}
            />
          ) : undefined
        }
      />

      {ehAdminOuAtendente && tecnicos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">Filtrar por técnico:</span>
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
        <Link href={`/agenda?inicio=${semanaAnterior}`} className="btn-secondary">
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Link>
        <Link href="/agenda" className="btn-secondary">Hoje</Link>
        <Link href={`/agenda?inicio=${proximaSemana}`} className="btn-secondary">
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

              <TurnoBloco titulo="Manhã" icone={<Sun className="h-3.5 w-3.5" />} itens={manha} podeCriar={podeCriar} podeCheckin={podeCheckin} />
              <div className="border-t border-slate-100" />
              <TurnoBloco titulo="Tarde" icone={<Sunset className="h-3.5 w-3.5" />} itens={tarde} podeCriar={podeCriar} podeCheckin={podeCheckin} />
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
  podeCriar,
  podeCheckin,
}: {
  titulo: string;
  icone: ReactNode;
  itens: any[];
  podeCriar: boolean;
  podeCheckin: boolean;
}) {
  return (
    <div className="flex-1 p-2">
      <p className="mb-1 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase text-slate-400">
        {icone} {titulo} {itens.length > 0 && <span className="text-slate-300">({itens.length})</span>}
      </p>
      <div className="space-y-2">
        {itens.length === 0 && <p className="px-1 py-1 text-center text-[11px] text-slate-300">—</p>}
        {itens.map((a) => (
          <CardAgendamento key={a.id} a={a} podeCriar={podeCriar} podeCheckin={podeCheckin} />
        ))}
      </div>
    </div>
  );
}

function CardAgendamento({
  a,
  podeCriar,
  podeCheckin,
}: {
  a: any;
  podeCriar: boolean;
  podeCheckin: boolean;
}) {
  const cli = a.clientes;
  const cancelado = a.status === "cancelado";
  const realizado = a.status === "realizado";
  const emAtendimento = a.status === "em_atendimento";
  return (
    <div className={`rounded-lg border-l-4 p-2 text-xs ${TIPO_AGENDAMENTO_COLOR[a.tipo] || ""} ${cancelado ? "opacity-50 line-through" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">{TIPO_AGENDAMENTO_LABEL[a.tipo]}</span>
        {(a.hora_inicio || a.hora_fim) && (
          <span className="flex items-center gap-0.5 text-[10px]">
            <Clock className="h-3 w-3" />
            {formatHora(a.hora_inicio)}{a.hora_fim ? `-${formatHora(a.hora_fim)}` : ""}
          </span>
        )}
      </div>
      <p className="mt-0.5 font-medium text-slate-800">{a.titulo}</p>
      {cli?.nome && <p className="text-slate-600">{cli.nome}</p>}
      {cli?.telefone && (
        <p className="flex items-center gap-0.5 text-slate-500">
          <Phone className="h-3 w-3" /> {formatTelefone(cli.telefone)}
        </p>
      )}
      {a.endereco && (
        <p className="flex items-start gap-0.5 text-slate-500">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {a.endereco}
        </p>
      )}
      {a.tecnico ? (
        <p className="text-slate-400">Téc.: {a.tecnico}</p>
      ) : (
        <p className="font-medium text-amber-600">Sem técnico atribuído</p>
      )}
      {a.os_id && (
        <Link href={`/ordens/${a.os_id}`} className="mt-1 flex items-center gap-0.5 font-medium text-brand-600 hover:underline">
          <Wrench className="h-3 w-3" /> Ver ordem de serviço
        </Link>
      )}
      {emAtendimento && <p className="mt-1 font-semibold text-brand-700">{STATUS_AGENDAMENTO_LABEL.em_atendimento}</p>}
      {realizado && <p className="mt-1 font-semibold text-green-700">✓ Realizado</p>}
      {a.checkin_at && !realizado && (
        <p className="mt-0.5 text-[10px] text-green-600">
          Check-in {new Date(a.checkin_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          <LinkMapaCheckin lat={a.checkin_lat} lng={a.checkin_lng} />
        </p>
      )}

      {podeCheckin && !cancelado && !realizado && (
        <div className="mt-1">
          <CheckinButtons
            agendamento={a}
            checkinAction={checkinAgendamento.bind(null, a.id)}
            checkoutAction={checkoutAgendamento.bind(null, a.id)}
          />
        </div>
      )}

      {podeCriar && !cancelado && !realizado && (
        <div className="mt-1 flex gap-1">
          <form action={alterarStatusAgendamento.bind(null, a.id, "realizado")}>
            <button className="rounded bg-white/70 p-1 text-green-600 hover:bg-white" title="Marcar realizado">
              <Check className="h-3 w-3" />
            </button>
          </form>
          <ConfirmButton
            action={excluirAgendamento.bind(null, a.id)}
            className="rounded bg-white/70 p-1 text-red-500 hover:bg-white"
            title="Excluir agendamento"
            message="Deseja excluir este agendamento da agenda?"
            confirmLabel="Excluir"
          >
            <X className="h-3 w-3" />
          </ConfirmButton>
        </div>
      )}
    </div>
  );
}

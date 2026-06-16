import Link from "next/link";
import { MapPin, Wrench, Plus, Clock, AlertTriangle, PenLine, LogIn, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OsPendentesLista } from "@/components/os-pendentes-lista";
import { PushAtivar } from "@/components/push-ativar";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { STATUS_OS_ABERTAS, ordenarOsPendentes } from "@/lib/os-status";
import { STATUS_AGENDA_PENDENTE, STATUS_OS_ATRASO, hojeYmd } from "@/lib/alertas";
import { DespesaCampoForm } from "@/components/despesa-campo-form";
import { CheckinButtons } from "@/components/checkin-buttons";
import { CompartilharGps } from "@/components/compartilhar-gps";
import { tecnicoDoProfile } from "@/lib/auth-guard";
import type { Profile } from "@/types/database";
import { formatCurrency, formatDate, formatHora, formatNumeroOS, TIPO_AGENDAMENTO_LABEL } from "@/lib/format";
import { lancarDespesaCampo, registrarPosicaoTecnico } from "./actions";
import { checkinAgendamento, checkoutAgendamento } from "../agenda/actions";

export async function CampoTecnico({ profile }: { profile: Profile }) {
  const tecnico = tecnicoDoProfile(profile);
  const supabase = await createClient();
  const hoje = hojeYmd();

  const [{ data: agendaHoje }, { data: despesas }, { data: osAbertas }] = await Promise.all([
    supabase
      .from("agendamentos")
      .select("*, clientes(nome, telefone)")
      .eq("data", hoje)
      .or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${tecnico}%`)
      .neq("status", "cancelado")
      .order("hora_inicio"),
    supabase
      .from("lancamentos_financeiros")
      .select("id, descricao, valor, status, data_competencia, observacoes")
      .eq("origem", "campo")
      .eq("criado_por", profile.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, prioridade, data_previsao, data_abertura, defeito_relatado, turno, assinatura_tecnico, clientes(nome, bairro, cidade)")
      .or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${tecnico}%`)
      .in("status", [...STATUS_OS_ABERTAS])
      .order("data_abertura", { ascending: false })
      .limit(30),
  ]);

  const osPendentes = ordenarOsPendentes(osAbertas || []);
  const osAtrasadas = (osAbertas || []).filter(
    (o) => o.data_previsao && o.data_previsao < hoje && STATUS_OS_ATRASO.includes(o.status as never)
  );
  const semAssinatura = (osAbertas || []).filter((o) => !o.assinatura_tecnico);
  const visitasPendentes = (agendaHoje || []).filter((a) =>
    STATUS_AGENDA_PENDENTE.includes(a.status as never)
  );
  const semCheckin = visitasPendentes.filter(
    (a) => (a.status === "agendado" || a.status === "confirmado") && !a.checkin_at
  );
  const emAtendimento = visitasPendentes.filter((a) => a.status === "em_atendimento");
  const atendimentoAtivo = emAtendimento[0];

  const osOpcoes = (osAbertas || []).map((o) => ({
    id: o.id,
    // @ts-expect-error relação
    label: `${formatNumeroOS(o.numero)} — ${o.clientes?.nome || ""}`,
  }));

  const totalDespesasMes = (despesas || [])
    .filter((d) => d.data_competencia?.startsWith(hoje.slice(0, 7)))
    .reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div>
      <PageHeader
        title={`Olá, ${profile.nome || tecnico}`}
        subtitle="Seu painel de campo — visitas, ordens e alertas do dia"
        action={
          <Link href="/ordens/nova" className="btn-primary">
            <Plus className="h-4 w-4" /> Nova OS
          </Link>
        }
      />

      <PushAtivar />

      <div className="mb-6">
        <CompartilharGps
          action={registrarPosicaoTecnico}
          emAtendimento={emAtendimento.length > 0}
          agendamentoId={atendimentoAtivo?.id}
        />
      </div>

      {/* Alertas rápidos */}
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AlertaCard
          href="/ordens"
          label="Visitas hoje"
          valor={visitasPendentes.length}
          icon={<Calendar className="h-4 w-4" />}
          tom="blue"
        />
        <AlertaCard
          href="/ordens"
          label="Atrasadas"
          valor={osAtrasadas.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          tom={osAtrasadas.length > 0 ? "red" : "default"}
        />
        <AlertaCard
          href="/ordens"
          label="Sem assinatura"
          valor={semAssinatura.length}
          icon={<PenLine className="h-4 w-4" />}
          tom={semAssinatura.length > 0 ? "amber" : "default"}
        />
        <AlertaCard
          href="/agenda"
          label="Sem check-in"
          valor={semCheckin.length}
          icon={<LogIn className="h-4 w-4" />}
          tom={semCheckin.length > 0 ? "amber" : "default"}
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Visitas hoje" value={String(visitasPendentes.length)} icon={<Clock className="h-5 w-5" />} tone="blue" />
        <StatCard title="Em atendimento" value={String(emAtendimento.length)} tone="amber" />
        <StatCard title="OS em aberto" value={String(osAbertas?.length || 0)} icon={<Wrench className="h-5 w-5" />} />
        <StatCard title="Despesas do mês" value={formatCurrency(totalDespesasMes)} tone="red" />
      </div>

      {/* Agenda de hoje — prioridade */}
      <div className="card mb-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Agenda de hoje</h2>
          <Link href="/agenda" className="text-sm text-brand-600 hover:underline">Ver semana</Link>
        </div>
        {visitasPendentes.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhuma visita pendente para hoje.</p>
        ) : (
          <div className="space-y-3">
            {visitasPendentes.map((a) => (
              <div
                key={a.id}
                className={`rounded-xl border p-4 ${
                  a.status === "em_atendimento"
                    ? "border-blue-300 bg-blue-50/50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-800">
                        {formatHora(a.hora_inicio)}{a.hora_fim ? `–${formatHora(a.hora_fim)}` : ""}
                      </span>
                      <span className="badge bg-slate-100 text-slate-600 text-[10px]">
                        {TIPO_AGENDAMENTO_LABEL[a.tipo]}
                      </span>
                      {a.status === "em_atendimento" && (
                        <span className="badge bg-blue-100 text-blue-700 text-[10px]">Em atendimento</span>
                      )}
                    </div>
                    <p className="mt-1 font-medium text-slate-800">{a.titulo}</p>
                    <p className="text-sm text-slate-500">
                      {/* @ts-expect-error relação */}
                      {a.clientes?.nome && a.clientes.nome}
                    </p>
                    {a.endereco && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-slate-400">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {a.endereco}
                      </p>
                    )}
                  </div>
                  <CheckinButtons
                    agendamento={a}
                    checkinAction={checkinAgendamento.bind(null, a.id)}
                    checkoutAction={checkoutAgendamento.bind(null, a.id)}
                  />
                </div>
                {a.os_id && (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link href={`/ordens/${a.os_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      Abrir ordem →
                    </Link>
                    <Link href={`/ordens/${a.os_id}/editar`} className="text-xs font-medium text-brand-600 hover:underline">
                      Editar valores / peças →
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OS que precisam de atenção */}
      {(osAtrasadas.length > 0 || semAssinatura.length > 0) && (
        <div className="card mb-6 p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Precisa da sua atenção</h2>
          <div className="space-y-2">
            {osAtrasadas.slice(0, 5).map((o) => (
              <Link
                key={`atraso-${o.id}`}
                href={`/ordens/${o.id}`}
                className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-sm hover:bg-red-50"
              >
                <span>
                  <span className="font-semibold text-red-800">{formatNumeroOS(o.numero)}</span>
                  <span className="ml-2 text-red-600">Visita atrasada ({formatDate(o.data_previsao!)})</span>
                </span>
                <StatusBadge status={o.status} />
              </Link>
            ))}
            {semAssinatura.slice(0, 5).map((o) => (
              <Link
                key={`sig-${o.id}`}
                href={`/ordens/${o.id}`}
                className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2 text-sm hover:bg-amber-50"
              >
                <span>
                  <span className="font-semibold text-amber-900">{formatNumeroOS(o.numero)}</span>
                  <span className="ml-2 text-amber-700">Assinatura pendente</span>
                </span>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Todas as minhas ordens</h2>
          <Link href="/ordens" className="text-sm text-brand-600 hover:underline">Ver todas</Link>
        </div>
        <OsPendentesLista
          lista={osPendentes as never[]}
          titulo={`${osPendentes.length} ordem(ns) atribuída(s) a você`}
        />
      </div>

      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Minhas despesas de campo</h2>
          <DespesaCampoForm action={lancarDespesaCampo} osOpcoes={osOpcoes} />
        </div>
        {!despesas || despesas.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Nenhuma despesa registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {despesas.map((d) => (
              <li key={d.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{d.descricao}</p>
                  <p className="text-xs text-slate-400">{formatDate(d.data_competencia)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">{formatCurrency(d.valor)}</p>
                  <span className={`text-xs ${d.status === "pago" ? "text-green-600" : "text-amber-600"}`}>
                    {d.status === "pago" ? "Reembolsado" : "Aguardando"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AlertaCard({
  href,
  label,
  valor,
  icon,
  tom = "default",
}: {
  href: string;
  label: string;
  valor: number;
  icon: React.ReactNode;
  tom?: "default" | "red" | "amber" | "blue";
}) {
  const cores = {
    default: "border-slate-200 bg-white text-slate-700",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-brand-200 bg-brand-50 text-brand-800",
  };
  return (
    <Link href={href} className={`rounded-xl border p-3 transition hover:shadow-sm ${cores[tom]}`}>
      <div className="flex items-center gap-2 text-xs font-medium opacity-80">
        {icon} {label}
      </div>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
    </Link>
  );
}

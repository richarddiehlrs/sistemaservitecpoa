import Link from "next/link";
import { Wrench, Plus, Clock, AlertTriangle, PenLine, LogIn, Calendar, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config";
import { OsPendentesLista } from "@/components/os-pendentes-lista";
import { PushAtivar } from "@/components/push-ativar";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { STATUS_OS_ABERTAS, ordenarOsPendentes } from "@/lib/os-status";
import { STATUS_AGENDA_PENDENTE, STATUS_OS_ATRASO, hojeYmd } from "@/lib/alertas";
import { DespesaCampoForm } from "@/components/despesa-campo-form";
import { CampoAgendaDia, type VisitaCampoDia } from "@/components/campo-agenda-dia";
import { CompartilharGps } from "@/components/compartilhar-gps";
import { tecnicoDoProfile } from "@/lib/auth-guard";
import { calcComissaoTecnico, calcLucroOsSimples } from "@/lib/produtividade-tecnico";
import type { Profile } from "@/types/database";
import { formatCurrency, formatDate, formatNumeroOS } from "@/lib/format";
import { lancarDespesaCampo, registrarPosicaoTecnico } from "./actions";
import { checkinAgendamento, checkoutAgendamento } from "../agenda/actions";

export async function CampoTecnico({ profile }: { profile: Profile }) {
  const tecnico = tecnicoDoProfile(profile);
  const supabase = await createClient();
  const hoje = hojeYmd();
  const inicioMes = `${hoje.slice(0, 7)}-01`;

  const [
    { data: agendaHoje },
    { data: despesas },
    { data: osAbertas },
    { data: osConcluidasMes },
    config,
  ] = await Promise.all([
    supabase
      .from("agendamentos")
      .select("*, clientes(nome, telefone), ordens_servico(numero)")
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
    supabase
      .from("ordens_servico")
      .select("valor_total, custo_total")
      .or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${tecnico}%`)
      .in("status", ["concluida", "entregue"])
      .gte("data_conclusao", inicioMes),
    getConfig(),
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

  const lucroMes = (osConcluidasMes || []).reduce(
    (s, o) => s + calcLucroOsSimples(Number(o.valor_total), Number(o.custo_total || 0)),
    0
  );
  const comissaoMes = calcComissaoTecnico(lucroMes, config.comissao_percent);

  const visitasSerializadas: VisitaCampoDia[] = visitasPendentes.map((a) => ({
    id: a.id,
    status: a.status,
    tipo: a.tipo,
    titulo: a.titulo,
    hora_inicio: a.hora_inicio,
    hora_fim: a.hora_fim,
    endereco: a.endereco,
    os_id: a.os_id,
    checkin_lat: a.checkin_lat,
    checkin_lng: a.checkin_lng,
    checkin_at: a.checkin_at,
    checkout_at: a.checkout_at,
    // @ts-expect-error relação
    clienteNome: a.clientes?.nome ?? null,
    // @ts-expect-error relação
    clienteTelefone: a.clientes?.telefone ?? null,
    // @ts-expect-error relação
    osNumero: a.ordens_servico?.numero ?? null,
  }));

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
      <div id="alertas" className="mb-6 grid scroll-mt-20 grid-cols-2 gap-2 sm:grid-cols-4">
        <AlertaCard
          href="/campo#visitas"
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
          href="/campo#visitas"
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

      {config.comissao_percent > 0 && (
        <div className="card mb-6 border-amber-100 bg-amber-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Trophy className="h-4 w-4" /> Comissão estimada ({config.comissao_percent}%)
              </p>
              <p className="mt-1 text-xs text-amber-800">
                {osConcluidasMes?.length || 0} OS concluída(s) no mês • lucro {formatCurrency(lucroMes)}
              </p>
            </div>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(comissaoMes)}</p>
          </div>
        </div>
      )}

      <div id="visitas" className="scroll-mt-20">
        <CampoAgendaDia
          visitas={visitasSerializadas}
          hoje={hoje}
          userId={profile.id}
          tecnicoNome={profile.nome || tecnico}
          checkinAgendamento={checkinAgendamento}
          checkoutAgendamento={checkoutAgendamento}
        />
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

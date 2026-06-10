import Link from "next/link";
import { MapPin, Wrench, Plus, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";
import { DespesaCampoForm } from "@/components/despesa-campo-form";
import { CheckinButtons } from "@/components/checkin-buttons";
import { requirePermissao, tecnicoDoProfile } from "@/lib/auth-guard";
import { formatCurrency, formatDate, formatHora, formatNumeroOS, TIPO_AGENDAMENTO_LABEL } from "@/lib/format";
import { lancarDespesaCampo } from "./actions";
import { checkinAgendamento, checkoutAgendamento } from "../agenda/actions";

export const dynamic = "force-dynamic";

export default async function CampoPage() {
  const profile = await requirePermissao("despesas_campo");
  const tecnico = tecnicoDoProfile(profile);
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const [{ data: agendaHoje }, { data: despesas }, { data: osAbertas }] = await Promise.all([
    supabase
      .from("agendamentos")
      .select("*, clientes(nome, telefone)")
      .eq("data", hoje)
      .or(`tecnico.ilike.%${tecnico}%,tecnico.is.null`)
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
      .select("id, numero, clientes(nome)")
      .eq("tecnico", tecnico)
      .in("status", ["aberta", "em_analise", "em_roteiro", "em_execucao", "aguardando_aprovacao", "aprovada"])
      .order("data_abertura", { ascending: false })
      .limit(20),
  ]);

  const osOpcoes = (osAbertas || []).map((o) => ({
    id: o.id,
    // @ts-expect-error relação
    label: `${formatNumeroOS(o.numero)} — ${o.clientes?.nome || ""}`,
  }));

  const totalDespesasMes = (despesas || [])
    .filter((d) => d.data_competencia?.startsWith(hoje.slice(0, 7)))
    .reduce((s, d) => s + Number(d.valor), 0);

  const emAtendimento = (agendaHoje || []).filter((a) => a.status === "em_atendimento").length;

  return (
    <div>
      <PageHeader
        title={`Olá, ${profile.nome || tecnico}`}
        subtitle="Painel de campo — atendimentos e despesas do dia"
        action={
          <Link href="/ordens/nova" className="btn-primary">
            <Plus className="h-4 w-4" /> Nova OS
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="Atendimentos hoje" value={String(agendaHoje?.length || 0)} icon={<Clock className="h-5 w-5" />} tone="blue" />
        <StatCard title="Em atendimento" value={String(emAtendimento)} tone="amber" />
        <StatCard title="Despesas do mês" value={formatCurrency(totalDespesasMes)} tone="red" />
        <StatCard title="OS em aberto" value={String(osAbertas?.length || 0)} icon={<Wrench className="h-5 w-5" />} />
      </div>

      {/* Agenda do dia */}
      <div className="card mb-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Agenda de hoje</h2>
          <Link href="/agenda" className="text-sm text-brand-600 hover:underline">Ver semana</Link>
        </div>
        {!agendaHoje || agendaHoje.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nenhum atendimento para hoje.</p>
        ) : (
          <div className="space-y-3">
            {agendaHoje.map((a) => (
              <div key={a.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{TIPO_AGENDAMENTO_LABEL[a.tipo]} — {a.titulo}</p>
                    <p className="text-sm text-slate-500">
                      {formatHora(a.hora_inicio)}{a.hora_fim ? `–${formatHora(a.hora_fim)}` : ""}
                      {/* @ts-expect-error relação */}
                      {a.clientes?.nome && ` • ${a.clientes.nome}`}
                    </p>
                    {a.endereco && (
                      <p className="mt-1 flex items-start gap-1 text-xs text-slate-400">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {a.endereco}
                      </p>
                    )}
                    {a.checkin_at && (
                      <p className="mt-1 text-xs text-green-600">
                        Check-in {new Date(a.checkin_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {a.checkout_at && ` → Check-out ${new Date(a.checkout_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
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
                  <Link href={`/ordens/${a.os_id}`} className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">
                    Abrir ordem de serviço →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Despesas */}
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

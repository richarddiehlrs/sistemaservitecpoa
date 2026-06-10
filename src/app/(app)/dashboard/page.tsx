import Link from "next/link";
import { Plus, Wrench, Users, DollarSign, AlertCircle, CalendarDays, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { MonthlyBars, HBarList } from "@/components/charts";
import { MetaCard } from "@/components/meta-card";
import { salvarMeta } from "@/app/(app)/financeiro/actions";
import { saldoEmAberto } from "@/lib/financeiro";
import {
  formatCurrency,
  formatDate,
  formatNumeroOS,
  formatHora,
  STATUS_OS_LABEL,
  TIPO_AGENDAMENTO_LABEL,
} from "@/lib/format";
import { STATUS_AGENDA_PENDENTE, STATUS_OS_ATRASO } from "@/lib/alertas";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";

export const dynamic = "force-dynamic";

function ultimosMeses(n: number) {
  const arr: { ano: number; mes: number; label: string; inicio: string }[] = [];
  const base = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    arr.push({
      ano: d.getFullYear(),
      mes: d.getMonth(),
      label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      inicio: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  return arr;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const meses = ultimosMeses(6);
  const inicio6m = new Date();
  inicio6m.setMonth(inicio6m.getMonth() - 5, 1);
  inicio6m.setHours(0, 0, 0, 0);
  const hojeStr = new Date().toISOString().slice(0, 10);

  const [
    { count: totalClientes },
    { count: osAbertas },
    { data: ultimasOS },
    { data: recebimentos },
    { data: contasReceber },
    { data: lanc6m },
    { data: ordensStatus },
    { data: agendaProx },
    { count: osAtrasadas },
    { count: osAguardandoAprovacao },
    { count: visitasHoje },
  ] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .in("status", [...STATUS_OS_ABERTAS]),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, valor_total, data_abertura, clientes(nome)")
      .order("data_abertura", { ascending: false })
      .limit(6),
    supabase
      .from("lancamentos_financeiros")
      .select("valor_pago")
      .eq("tipo", "receita")
      .in("status", ["pago", "parcial"])
      .gte("data_pagamento", inicioMes.toISOString().slice(0, 10)),
    supabase
      .from("lancamentos_financeiros")
      .select("valor, valor_pago, juros, multa")
      .eq("tipo", "receita")
      .in("status", ["pendente", "parcial"]),
    supabase
      .from("lancamentos_financeiros")
      .select("tipo, valor, data_pagamento")
      .eq("status", "pago")
      .gte("data_pagamento", inicio6m.toISOString().slice(0, 10)),
    supabase.from("ordens_servico").select("status"),
    supabase
      .from("agendamentos")
      .select("id, titulo, tipo, data, hora_inicio, endereco, status, os_id, tecnico, clientes(nome)")
      .gte("data", hojeStr)
      .in("status", [...STATUS_AGENDA_PENDENTE])
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true })
      .limit(8),
    supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .in("status", [...STATUS_OS_ATRASO])
      .lt("data_previsao", hojeStr)
      .not("data_previsao", "is", null),
    supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .eq("status", "aguardando_aprovacao"),
    supabase
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("data", hojeStr)
      .in("status", [...STATUS_AGENDA_PENDENTE]),
  ]);

  const receitaMes = (recebimentos || []).reduce((s, r) => s + Number(r.valor_pago), 0);
  const aReceber = (contasReceber || []).reduce((s, r) => s + saldoEmAberto(r), 0);

  const anoAtual = new Date().getFullYear();
  const mesAtual = new Date().getMonth() + 1;
  const { data: metaRow } = await supabase
    .from("metas_faturamento")
    .select("valor")
    .eq("ano", anoAtual)
    .eq("mes", mesAtual)
    .maybeSingle();
  const meta = Number(metaRow?.valor || 0);

  // Receita x despesa dos últimos 6 meses
  const chartData = meses.map((m) => {
    const doMes = (lanc6m || []).filter((l) => (l.data_pagamento || "").startsWith(m.inicio));
    return {
      label: m.label,
      receita: doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0),
      despesa: doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0),
    };
  });

  // OS por status
  const statusCount: Record<string, number> = {};
  for (const o of ordensStatus || []) statusCount[o.status] = (statusCount[o.status] || 0) + 1;
  const statusItems = Object.entries(statusCount)
    .map(([k, v]) => ({ label: STATUS_OS_LABEL[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral da operação"
        action={
          <Link href="/ordens/nova" className="btn-primary">
            <Plus className="h-4 w-4" /> Nova OS
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="OS em aberto" value={String(osAbertas ?? 0)} icon={<Wrench className="h-5 w-5" />} tone="blue" />
        <StatCard title="Clientes" value={String(totalClientes ?? 0)} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Recebido no mês" value={formatCurrency(receitaMes)} icon={<DollarSign className="h-5 w-5" />} tone="green" />
        <StatCard title="A receber" value={formatCurrency(aReceber)} icon={<AlertCircle className="h-5 w-5" />} tone="amber" />
      </div>

      {(osAtrasadas || osAguardandoAprovacao || visitasHoje) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {(osAtrasadas ?? 0) > 0 && (
            <Link href="/ordens?status=em_roteiro" className="badge bg-red-100 text-red-700 ring-1 ring-red-200 hover:bg-red-200">
              {osAtrasadas} OS com visita atrasada
            </Link>
          )}
          {(osAguardandoAprovacao ?? 0) > 0 && (
            <Link href="/ordens?status=aguardando_aprovacao" className="badge bg-amber-100 text-amber-800 ring-1 ring-amber-200 hover:bg-amber-200">
              {osAguardandoAprovacao} aguardando aprovação
            </Link>
          )}
          {(visitasHoje ?? 0) > 0 && (
            <Link href="/agenda" className="badge bg-brand-100 text-brand-800 ring-1 ring-brand-200 hover:bg-brand-200">
              {visitasHoje} visita(s) hoje na agenda
            </Link>
          )}
        </div>
      ) : null}

      {/* Gráficos */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-900">Receitas x Despesas (6 meses)</h2>
          <MonthlyBars data={chartData} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Ordens por status</h2>
          <HBarList items={statusItems} formatValue={(v) => String(v)} />
        </div>
      </div>

      <div className="mt-6">
        <MetaCard ano={anoAtual} mes={mesAtual} meta={meta} realizado={receitaMes} action={salvarMeta} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Últimas OS */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="font-semibold text-slate-900">Últimas ordens de serviço</h2>
            <Link href="/ordens" className="text-sm font-medium text-brand-600 hover:underline">Ver todas</Link>
          </div>
          {!ultimasOS || ultimasOS.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">Nenhuma ordem de serviço cadastrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>OS</th>
                    <th>Cliente</th>
                    <th>Abertura</th>
                    <th>Status</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ultimasOS.map((os) => (
                    <tr key={os.id}>
                      <td className="font-medium">
                        <Link href={`/ordens/${os.id}`} className="text-brand-600 hover:underline">
                          {formatNumeroOS(os.numero)}
                        </Link>
                      </td>
                      {/* @ts-expect-error relação */}
                      <td>{os.clientes?.nome ?? "-"}</td>
                      <td>{formatDate(os.data_abertura)}</td>
                      <td><StatusBadge status={os.status} /></td>
                      <td className="text-right font-medium">{formatCurrency(os.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Próximos agendamentos */}
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <CalendarDays className="h-4 w-4" /> Próximos atendimentos
            </h2>
            <Link href="/agenda" className="text-sm font-medium text-brand-600 hover:underline">Agenda</Link>
          </div>
          <div className="space-y-2 p-4">
            {!agendaProx || agendaProx.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Nenhum atendimento agendado.</p>
            ) : (
              agendaProx.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-800">{TIPO_AGENDAMENTO_LABEL[a.tipo]}</span>
                    <span className="text-xs text-slate-500">
                      {formatDate(a.data)} {formatHora(a.hora_inicio)}
                    </span>
                  </div>
                  <p className="text-slate-600">{a.titulo}</p>
                  {a.tecnico && <p className="text-xs text-slate-400">Téc.: {a.tecnico}</p>}
                  {a.os_id && (
                    <Link href={`/ordens/${a.os_id}`} className="text-xs font-medium text-brand-600 hover:underline">
                      Ver ordem de serviço →
                    </Link>
                  )}
                  {/* @ts-expect-error relação */}
                  {a.clientes?.nome && <p className="text-xs text-slate-500">{a.clientes.nome}</p>}
                  {a.endereco && (
                    <p className="flex items-start gap-1 text-xs text-slate-400">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" /> {a.endereco}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

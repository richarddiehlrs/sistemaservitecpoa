import Link from "next/link";
import { Plus, Wrench, Users, DollarSign, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { formatCurrency, formatDate, formatNumeroOS } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS_ABERTAS = [
  "aberta",
  "em_analise",
  "aguardando_aprovacao",
  "aprovada",
  "em_execucao",
  "aguardando_peca",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [
    { count: totalClientes },
    { count: osAbertas },
    { data: ultimasOS },
    { data: recebimentos },
    { data: contasReceber },
  ] = await Promise.all([
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    supabase
      .from("ordens_servico")
      .select("id", { count: "exact", head: true })
      .in("status", STATUS_ABERTAS),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, valor_total, data_abertura, clientes(nome)")
      .order("data_abertura", { ascending: false })
      .limit(8),
    supabase
      .from("lancamentos_financeiros")
      .select("valor")
      .eq("tipo", "receita")
      .eq("status", "pago")
      .gte("data_pagamento", inicioMes.toISOString().slice(0, 10)),
    supabase
      .from("lancamentos_financeiros")
      .select("valor")
      .eq("tipo", "receita")
      .eq("status", "pendente"),
  ]);

  const receitaMes = (recebimentos || []).reduce((s, r) => s + Number(r.valor), 0);
  const aReceber = (contasReceber || []).reduce((s, r) => s + Number(r.valor), 0);

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
        <StatCard
          title="OS em aberto"
          value={String(osAbertas ?? 0)}
          icon={<Wrench className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          title="Clientes"
          value={String(totalClientes ?? 0)}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Recebido no mês"
          value={formatCurrency(receitaMes)}
          icon={<DollarSign className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          title="A receber"
          value={formatCurrency(aReceber)}
          icon={<AlertCircle className="h-5 w-5" />}
          tone="amber"
        />
      </div>

      <div className="mt-6 card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Últimas ordens de serviço</h2>
          <Link href="/ordens" className="text-sm font-medium text-brand-600 hover:underline">
            Ver todas
          </Link>
        </div>
        {!ultimasOS || ultimasOS.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">
            Nenhuma ordem de serviço cadastrada ainda.
          </p>
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
                    {/* @ts-expect-error relação embutida */}
                    <td>{os.clientes?.nome ?? "-"}</td>
                    <td>{formatDate(os.data_abertura)}</td>
                    <td>
                      <StatusBadge status={os.status} />
                    </td>
                    <td className="text-right font-medium">
                      {formatCurrency(os.valor_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { Check, X, TrendingUp, TrendingDown, Wallet, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { LancamentoForm } from "@/components/lancamento-form";
import { ConfirmButton } from "@/components/confirm-button";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  criarLancamento,
  marcarPago,
  cancelarLancamento,
} from "./actions";

export const dynamic = "force-dynamic";

function inicioFimMes(mesStr?: string) {
  const base = mesStr ? new Date(mesStr + "-01T00:00:00") : new Date();
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
  const fim = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    label: base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    value: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`,
  };
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tipo?: string; status?: string }>;
}) {
  const { mes, tipo, status } = await searchParams;
  const periodo = inicioFimMes(mes);
  const supabase = await createClient();

  let query = supabase
    .from("lancamentos_financeiros")
    .select("*, categorias_financeiras(nome), clientes(nome)")
    .gte("data_competencia", periodo.inicio)
    .lte("data_competencia", periodo.fim)
    .order("data_competencia", { ascending: false });

  if (tipo) query = query.eq("tipo", tipo);
  if (status) query = query.eq("status", status);

  const [{ data: lancamentos }, { data: categorias }] = await Promise.all([
    query,
    supabase.from("categorias_financeiras").select("*").order("nome"),
  ]);

  const lista = lancamentos || [];
  const receitas = lista.filter((l) => l.tipo === "receita" && l.status !== "cancelado");
  const despesas = lista.filter((l) => l.tipo === "despesa" && l.status !== "cancelado");
  const totalReceita = receitas.reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesa = despesas.reduce((s, l) => s + Number(l.valor), 0);
  const aReceber = receitas.filter((l) => l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0);
  const aPagar = despesas.filter((l) => l.status === "pendente").reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totalReceita - totalDespesa;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle={`Contas a receber e a pagar — ${periodo.label}`}
        action={<LancamentoForm categorias={categorias || []} action={criarLancamento} />}
      />

      {/* Filtro de mês */}
      <form className="mb-4 flex flex-wrap items-center gap-2" action="/financeiro" method="get">
        <input type="month" name="mes" defaultValue={periodo.value} className="input max-w-[180px]" />
        <select name="tipo" defaultValue={tipo || ""} className="input max-w-[160px]">
          <option value="">Todos os tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
        <select name="status" defaultValue={status || ""} className="input max-w-[160px]">
          <option value="">Todas situações</option>
          <option value="pendente">Pendentes</option>
          <option value="pago">Pagos</option>
          <option value="cancelado">Cancelados</option>
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Receitas" value={formatCurrency(totalReceita)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Despesas" value={formatCurrency(totalDespesa)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Saldo" value={formatCurrency(saldo)} tone={saldo >= 0 ? "blue" : "red"} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="A receber" value={formatCurrency(aReceber)} tone="amber" icon={<Clock className="h-5 w-5" />} />
        <StatCard title="A pagar" value={formatCurrency(aPagar)} tone="amber" icon={<Clock className="h-5 w-5" />} />
      </div>

      <div className="mt-6 card overflow-x-auto">
        {lista.length === 0 ? (
          <EmptyState title="Nenhum lançamento no período" description="Adicione receitas e despesas para acompanhar o caixa." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Competência</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Situação</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((l) => (
                <tr key={l.id} className={l.status === "cancelado" ? "opacity-50" : ""}>
                  <td>{formatDate(l.data_competencia)}</td>
                  <td className="font-medium">
                    {l.descricao}
                    {/* @ts-expect-error relação */}
                    {l.clientes?.nome && <span className="block text-xs text-slate-400">{l.clientes.nome}</span>}
                  </td>
                  {/* @ts-expect-error relação */}
                  <td>{l.categorias_financeiras?.nome || "-"}</td>
                  <td>
                    <span className={`badge ${
                      l.status === "pago" ? "bg-green-100 text-green-700"
                      : l.status === "cancelado" ? "bg-slate-100 text-slate-500"
                      : "bg-amber-100 text-amber-700"
                    }`}>
                      {l.status === "pago" ? "Pago" : l.status === "cancelado" ? "Cancelado" : "Pendente"}
                    </span>
                  </td>
                  <td className={`text-right font-semibold ${l.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>
                    {l.tipo === "receita" ? "+" : "-"} {formatCurrency(l.valor)}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {l.status === "pendente" && (
                        <form action={marcarPago.bind(null, l.id)}>
                          <button className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Marcar como pago">
                            <Check className="h-4 w-4" />
                          </button>
                        </form>
                      )}
                      {l.status !== "cancelado" && (
                        <ConfirmButton
                          action={cancelarLancamento.bind(null, l.id)}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Cancelar lançamento"
                          message="Deseja realmente cancelar este lançamento financeiro?"
                          confirmLabel="Cancelar lançamento"
                        >
                          <X className="h-4 w-4" />
                        </ConfirmButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

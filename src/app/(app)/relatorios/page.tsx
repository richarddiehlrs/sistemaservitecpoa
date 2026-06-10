import { TrendingUp, TrendingDown, Wallet, Receipt, Wrench, Trophy, PiggyBank, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config";
import { PageHeader, StatCard } from "@/components/ui";
import { MonthlyBars, HBarList } from "@/components/charts";
import { formatCurrency, formatNumeroOS, STATUS_OS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

const MESES_CURTOS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const sp = await searchParams;
  const ano = Number(sp.ano) || new Date().getFullYear();
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  const supabase = await createClient();

  const [{ data: pagos }, { data: aReceberData }, { data: ordens }, config] = await Promise.all([
    supabase
      .from("lancamentos_financeiros")
      .select("tipo, valor, data_pagamento, cliente_id, clientes(nome), categorias_financeiras(nome)")
      .eq("status", "pago")
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim),
    supabase
      .from("lancamentos_financeiros")
      .select("valor")
      .eq("tipo", "receita")
      .eq("status", "pendente")
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, valor_total, custo_total, tecnico, data_abertura, clientes(nome)")
      .gte("data_abertura", inicio)
      .lte("data_abertura", `${fim}T23:59:59`),
    getConfig(),
  ]);

  const lista = pagos || [];
  const receitas = lista.filter((l) => l.tipo === "receita");
  const despesas = lista.filter((l) => l.tipo === "despesa");

  const totalReceita = receitas.reduce((s, l) => s + Number(l.valor), 0);
  const totalDespesa = despesas.reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totalReceita - totalDespesa;
  const aReceber = (aReceberData || []).reduce((s, l) => s + Number(l.valor), 0);

  // Mensal
  const chartData = MESES_CURTOS.map((label, i) => {
    const mesStr = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const doMes = lista.filter((l) => (l.data_pagamento || "").startsWith(mesStr));
    return {
      label,
      receita: doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0),
      despesa: doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor), 0),
    };
  });

  // OS
  const qtdOS = (ordens || []).length;
  const concluidas = (ordens || []).filter((o) => ["concluida", "entregue"].includes(o.status)).length;
  const ticketMedio = concluidas > 0
    ? (ordens || []).filter((o) => ["concluida", "entregue"].includes(o.status)).reduce((s, o) => s + Number(o.valor_total), 0) / concluidas
    : 0;

  const statusCount: Record<string, number> = {};
  for (const o of ordens || []) statusCount[o.status] = (statusCount[o.status] || 0) + 1;
  const statusItems = Object.entries(statusCount)
    .map(([k, v]) => ({ label: STATUS_OS_LABEL[k] || k, value: v }))
    .sort((a, b) => b.value - a.value);

  // Top clientes por faturamento (receitas pagas)
  const porCliente: Record<string, { nome: string; total: number }> = {};
  for (const r of receitas) {
    const id = r.cliente_id || "sem";
    // @ts-expect-error relação
    const nome = r.clientes?.nome || "Sem cliente";
    if (!porCliente[id]) porCliente[id] = { nome, total: 0 };
    porCliente[id].total += Number(r.valor);
  }
  const topClientes = Object.values(porCliente)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map((c) => ({ label: c.nome, value: c.total, color: "bg-green-500" }));

  // Receita por categoria
  const porCategoria: Record<string, number> = {};
  for (const r of receitas) {
    // @ts-expect-error relação
    const nome = r.categorias_financeiras?.nome || "Outras";
    porCategoria[nome] = (porCategoria[nome] || 0) + Number(r.valor);
  }
  const categoriaItems = Object.entries(porCategoria)
    .map(([label, value]) => ({ label, value, color: "bg-brand-500" }))
    .sort((a, b) => b.value - a.value);

  // ===== Lucratividade (OS concluídas/entregues) =====
  const faturadas = (ordens || []).filter((o) => ["concluida", "entregue"].includes(o.status));
  const lucroOS = faturadas.map((o) => ({
    id: o.id,
    numero: o.numero,
    // @ts-expect-error relação
    cliente: o.clientes?.nome || "Sem cliente",
    tecnico: o.tecnico || "Sem técnico",
    receita: Number(o.valor_total),
    custo: Number(o.custo_total || 0),
    lucro: Number(o.valor_total) - Number(o.custo_total || 0),
  }));

  const lucroTotal = lucroOS.reduce((s, o) => s + o.lucro, 0);
  const custoTotal = lucroOS.reduce((s, o) => s + o.custo, 0);
  const margem = lucroOS.reduce((s, o) => s + o.receita, 0) > 0
    ? (lucroTotal / lucroOS.reduce((s, o) => s + o.receita, 0)) * 100
    : 0;

  const topLucroOS = [...lucroOS].sort((a, b) => b.lucro - a.lucro).slice(0, 8);

  // Lucro por cliente
  const porClienteLucro: Record<string, number> = {};
  for (const o of lucroOS) porClienteLucro[o.cliente] = (porClienteLucro[o.cliente] || 0) + o.lucro;
  const lucroClienteItems = Object.entries(porClienteLucro)
    .map(([label, value]) => ({ label, value, color: "bg-emerald-500" }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Comissão por técnico (% sobre o lucro)
  const comissaoPercent = Number(config.comissao_percent || 0);
  const porTecnico: Record<string, { lucro: number; receita: number; qtd: number }> = {};
  for (const o of lucroOS) {
    if (!porTecnico[o.tecnico]) porTecnico[o.tecnico] = { lucro: 0, receita: 0, qtd: 0 };
    porTecnico[o.tecnico].lucro += o.lucro;
    porTecnico[o.tecnico].receita += o.receita;
    porTecnico[o.tecnico].qtd += 1;
  }
  const tecnicos = Object.entries(porTecnico)
    .map(([nome, v]) => ({ nome, ...v, comissao: (v.lucro * comissaoPercent) / 100 }))
    .sort((a, b) => b.lucro - a.lucro);

  return (
    <div>
      <PageHeader title="Relatórios gerenciais" subtitle={`Desempenho do ano de ${ano}`} />

      <form className="mb-6 flex items-center gap-2" action="/relatorios" method="get">
        <select name="ano" defaultValue={String(ano)} className="input max-w-[140px]">
          {[0, 1, 2, 3].map((d) => {
            const y = new Date().getFullYear() - d;
            return <option key={y} value={y}>{y}</option>;
          })}
        </select>
        <button className="btn-secondary">Gerar</button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Faturamento" value={formatCurrency(totalReceita)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Despesas" value={formatCurrency(totalDespesa)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Resultado" value={formatCurrency(saldo)} tone={saldo >= 0 ? "blue" : "red"} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="A receber" value={formatCurrency(aReceber)} tone="amber" icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="OS no ano" value={String(qtdOS)} icon={<Wrench className="h-5 w-5" />} hint={`${concluidas} concluídas`} />
        <StatCard title="Ticket médio" value={formatCurrency(ticketMedio)} tone="blue" icon={<Trophy className="h-5 w-5" />} />
      </div>

      <div className="mt-6 card p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Receitas x Despesas por mês</h2>
        <MonthlyBars data={chartData} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Top clientes (faturamento)</h2>
          <HBarList items={topClientes} formatValue={formatCurrency} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Receita por categoria</h2>
          <HBarList items={categoriaItems} formatValue={formatCurrency} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Ordens por status</h2>
          <HBarList items={statusItems} formatValue={(v) => String(v)} />
        </div>
      </div>

      {/* Lucratividade */}
      <h2 className="mt-10 mb-4 text-lg font-semibold text-slate-900">Lucratividade</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Lucro bruto (OS)" value={formatCurrency(lucroTotal)} tone="green" icon={<PiggyBank className="h-5 w-5" />} hint={`${faturadas.length} OS faturadas`} />
        <StatCard title="Custo total" value={formatCurrency(custoTotal)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Margem média" value={`${margem.toFixed(1)}%`} tone="blue" icon={<Percent className="h-5 w-5" />} />
        <StatCard title="Comissão técnicos" value={formatCurrency(tecnicos.reduce((s, t) => s + t.comissao, 0))} tone="amber" icon={<Trophy className="h-5 w-5" />} hint={`${comissaoPercent}% do lucro`} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Lucro por cliente</h2>
          <HBarList items={lucroClienteItems} formatValue={formatCurrency} />
        </div>
        <div className="card overflow-x-auto p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Comissão por técnico</h2>
          {tecnicos.length === 0 ? (
            <p className="text-sm text-slate-400">Sem OS faturadas no período.</p>
          ) : (
            <table className="table-base">
              <thead>
                <tr>
                  <th>Técnico</th>
                  <th className="text-center">OS</th>
                  <th className="text-right">Lucro</th>
                  <th className="text-right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {tecnicos.map((t) => (
                  <tr key={t.nome}>
                    <td className="font-medium">{t.nome}</td>
                    <td className="text-center">{t.qtd}</td>
                    <td className="text-right text-green-600">{formatCurrency(t.lucro)}</td>
                    <td className="text-right font-semibold text-amber-600">{formatCurrency(t.comissao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="mt-6 card overflow-x-auto p-5">
        <h2 className="mb-4 font-semibold text-slate-900">Maiores lucros por OS</h2>
        {topLucroOS.length === 0 ? (
          <p className="text-sm text-slate-400">Sem OS faturadas no período.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>OS</th>
                <th>Cliente</th>
                <th className="text-right">Receita</th>
                <th className="text-right">Custo</th>
                <th className="text-right">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {topLucroOS.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{formatNumeroOS(o.numero)}</td>
                  <td>{o.cliente}</td>
                  <td className="text-right">{formatCurrency(o.receita)}</td>
                  <td className="text-right text-red-600">{formatCurrency(o.custo)}</td>
                  <td className="text-right font-semibold text-green-600">{formatCurrency(o.lucro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {comissaoPercent === 0 && (
        <p className="mt-3 text-xs text-slate-400">
          Defina o percentual de comissão em Configurações para calcular a comissão dos técnicos automaticamente.
        </p>
      )}
    </div>
  );
}

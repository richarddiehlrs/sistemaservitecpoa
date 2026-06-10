import { TrendingUp, TrendingDown, Wallet, Receipt, Wrench, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatCard } from "@/components/ui";
import { MonthlyBars, HBarList } from "@/components/charts";
import { formatCurrency, STATUS_OS_LABEL } from "@/lib/format";

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

  const [{ data: pagos }, { data: aReceberData }, { data: ordens }] = await Promise.all([
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
      .select("status, valor_total, data_abertura")
      .gte("data_abertura", inicio)
      .lte("data_abertura", `${fim}T23:59:59`),
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
    </div>
  );
}

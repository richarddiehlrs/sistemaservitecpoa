import { TrendingUp, TrendingDown, Wallet, Receipt, Wrench, Trophy, PiggyBank, Percent } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, StatCard } from "@/components/ui";
import { MonthlyBars, HBarList } from "@/components/charts";
import { formatCurrency, formatNumeroOS, STATUS_OS_LABEL } from "@/lib/format";
import { saldoEmAberto } from "@/lib/financeiro";
import { calcLucroOs, calcMetricasCaixa, calcMetricasCompetencia } from "@/lib/metricas-financeiras";

export const dynamic = "force-dynamic";

const MESES_CURTOS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const sp = await searchParams;
  await requirePermissao("relatorios");
  const ano = Number(sp.ano) || new Date().getFullYear();
  const inicio = `${ano}-01-01`;
  const fim = `${ano}-12-31`;

  const supabase = await createClient();

  const [{ data: pagos }, { data: aReceberData }, { data: ordens }, { data: lancAno }, config] = await Promise.all([
    supabase
      .from("lancamentos_financeiros")
      .select("tipo, valor_pago, data_pagamento, cliente_id, clientes(nome), categorias_financeiras(nome)")
      .in("status", ["pago", "parcial"])
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim),
    supabase
      .from("lancamentos_financeiros")
      .select("valor, valor_pago, juros, multa")
      .eq("tipo", "receita")
      .in("status", ["pendente", "parcial"])
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, valor_total, custo_total, tecnico, data_abertura, clientes(nome)")
      .gte("data_abertura", inicio)
      .lte("data_abertura", `${fim}T23:59:59`),
    supabase
      .from("lancamentos_financeiros")
      .select("tipo, valor, juros, multa, valor_pago, status, os_id, categorias_financeiras(grupo_dre)")
      .neq("status", "cancelado")
      .gte("data_competencia", inicio)
      .lte("data_competencia", fim),
    getConfig(),
  ]);

  const lista = pagos || [];
  const receitas = lista.filter((l) => l.tipo === "receita");
  const despesas = lista.filter((l) => l.tipo === "despesa");

  const totalReceita = receitas.reduce((s, l) => s + Number(l.valor_pago), 0);
  const totalDespesa = despesas.reduce((s, l) => s + Number(l.valor_pago), 0);
  const saldo = totalReceita - totalDespesa;
  const aReceber = (aReceberData || []).reduce((s, l) => s + saldoEmAberto(l), 0);

  const metricasCaixa = calcMetricasCaixa(lista);
  const metricasCompetencia = calcMetricasCompetencia(lancAno || []);

  // Mensal
  const chartData = MESES_CURTOS.map((label, i) => {
    const mesStr = `${ano}-${String(i + 1).padStart(2, "0")}`;
    const doMes = lista.filter((l) => (l.data_pagamento || "").startsWith(mesStr));
    return {
      label,
      receita: doMes.filter((l) => l.tipo === "receita").reduce((s, l) => s + Number(l.valor_pago), 0),
      despesa: doMes.filter((l) => l.tipo === "despesa").reduce((s, l) => s + Number(l.valor_pago), 0),
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
    porCliente[id].total += Number(r.valor_pago);
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
    porCategoria[nome] = (porCategoria[nome] || 0) + Number(r.valor_pago);
  }
  const categoriaItems = Object.entries(porCategoria)
    .map(([label, value]) => ({ label, value, color: "bg-brand-500" }))
    .sort((a, b) => b.value - a.value);

  // ===== Lucratividade por OS (via lançamentos financeiros) =====
  const osComLancamento = new Set((lancAno || []).filter((l) => l.os_id).map((l) => l.os_id!));
  const faturadas = (ordens || []).filter(
    (o) => ["concluida", "entregue", "aprovada"].includes(o.status) || osComLancamento.has(o.id)
  );

  const lucroOS = faturadas.map((o) => {
    const lancOs = (lancAno || []).filter((l) => l.os_id === o.id && l.status !== "cancelado");
    const { receita: receitaLanc, custo: custoLanc, lucroBruto } = calcLucroOs(lancOs);
    const receita = receitaLanc > 0 ? receitaLanc : Number(o.valor_total);
    const custo = custoLanc > 0 ? custoLanc : Number(o.custo_total || 0);
    const lucro = receitaLanc > 0 || custoLanc > 0 ? lucroBruto : receita - custo;
    return {
      id: o.id,
      numero: o.numero,
      // @ts-expect-error relação
      cliente: o.clientes?.nome || "Sem cliente",
      tecnico: o.tecnico || "Sem técnico",
      receita,
      custo,
      lucro,
    };
  });

  const lucroTotal = metricasCompetencia.lucroBruto;
  const custoTotal = metricasCompetencia.custoDireto;
  const margem = metricasCompetencia.margemBruta;

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
      <PageHeader
        title="Relatórios gerenciais"
        subtitle={`Desempenho do ano de ${ano}`}
        action={
          <Link href="/relatorios/produtividade" className="btn-secondary">
            Produtividade por técnico
          </Link>
        }
      />

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
        <StatCard title="Recebido (caixa)" value={formatCurrency(totalReceita)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Pago (caixa)" value={formatCurrency(totalDespesa)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Lucro bruto" value={formatCurrency(metricasCompetencia.lucroBruto)} tone="blue" icon={<PiggyBank className="h-5 w-5" />} hint={`${metricasCompetencia.margemBruta}% margem`} />
        <StatCard title="Lucro líquido" value={formatCurrency(metricasCompetencia.lucroLiquido)} tone={metricasCompetencia.lucroLiquido >= 0 ? "green" : "red"} icon={<Percent className="h-5 w-5" />} hint={`Caixa: ${formatCurrency(metricasCaixa.lucroLiquido)}`} />
        <StatCard title="A receber" value={formatCurrency(aReceber)} tone="amber" icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="OS no ano" value={String(qtdOS)} icon={<Wrench className="h-5 w-5" />} hint={`${concluidas} concluídas`} />
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
        <StatCard title="Lucro bruto (ano)" value={formatCurrency(lucroTotal)} tone="green" icon={<PiggyBank className="h-5 w-5" />} hint={`${faturadas.length} OS no relatório`} />
        <StatCard title="Custo direto (ano)" value={formatCurrency(custoTotal)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Despesas operacionais" value={formatCurrency(metricasCompetencia.despesas)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Margem bruta" value={`${margem.toFixed(1)}%`} tone="blue" icon={<Percent className="h-5 w-5" />} />
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

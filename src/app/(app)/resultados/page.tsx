import Link from "next/link";
import { ChevronLeft, ChevronRight, Target, TrendingUp, Wallet, Package, Fuel, PiggyBank, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader } from "@/components/ui";
import { HBarList } from "@/components/charts";
import { ActionForm } from "@/components/use-action";
import { GraficoResultado } from "@/components/grafico-resultado";
import { formatCurrency, formatNumeroOS, hojeYmdLocal } from "@/lib/format";
import { calcularDre, limitesMes, mesesAte, receitaARealizar, ritmoMeta } from "@/lib/resultado";
import { carregarBaseResultado } from "@/lib/resultado-dados";
import { salvarMeta } from "@/app/(app)/financeiro/actions";

export const dynamic = "force-dynamic";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function deslocar(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Painel gerencial: meta, faturamento, lucro, peças e despesas do técnico — tudo pela mesma regra da DRE. */
export default async function ResultadosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  await requirePermissao("relatorios");
  const hoje = hojeYmdLocal();
  const mesAtual = hoje.slice(0, 7);
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : mesAtual;
  const [ano, mesNum] = mes.split("-").map(Number);
  const { inicio, fim } = limitesMes(mes);
  const meses = mesesAte(mes, 12);
  const inicio12 = limitesMes(meses[0]).inicio;

  const supabase = await createClient();
  const [base, { data: metas }, { data: recebRows }] = await Promise.all([
    carregarBaseResultado(supabase, inicio12, fim),
    supabase.from("metas_faturamento").select("ano, mes, valor").gte("ano", Number(meses[0].slice(0, 4))).lte("ano", ano),
    supabase
      .from("os_pagamentos")
      .select("valor, taxa, lancamentos_financeiros!inner(tipo)")
      .eq("lancamentos_financeiros.tipo", "receita")
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim)
      .limit(5000),
  ]);

  const metaDe = (mk: string) => Number((metas || []).find((x) => x.ano === Number(mk.slice(0, 4)) && x.mes === Number(mk.slice(5)))?.valor ?? 0);
  const serie = meses.map((mk) => {
    const l = limitesMes(mk);
    const d = calcularDre(base.lancamentos, base.os, base.taxas, l.inicio, l.fim);
    return { mk, d };
  });
  const dre = serie[serie.length - 1].d;
  const anterior = serie[serie.length - 2]?.d;
  const meta = metaDe(mes);
  const ritmo = ritmoMeta({ meta, realizado: dre.receitaBruta, mes, hoje });
  const recebido = ((recebRows || []) as unknown as { valor: number; taxa: number }[]).reduce((s, r) => s + Number(r.valor) - Number(r.taxa || 0), 0);
  const aRealizar = receitaARealizar(base.lancamentos, base.os);

  const variacao = (atual: number, ant?: number) => (ant && ant !== 0 ? Math.round(((atual - ant) / Math.abs(ant)) * 1000) / 10 : null);

  // Despesas lançadas em campo no mês, por categoria
  const campo = new Map<string, number>();
  for (const l of base.lancamentos) {
    if (l.origem !== "campo" || l.tipo !== "despesa" || l.status === "cancelado") continue;
    if (l.data_competencia < inicio || l.data_competencia > fim) continue;
    const c = (l.categoria ?? "Outras").replace(" / deslocamento", "");
    campo.set(c, (campo.get(c) ?? 0) + Number(l.valor));
  }
  const campoItens = [...campo.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value, color: "bg-orange-500" }));
  const totalCampo = [...campo.values()].reduce((s, v) => s + v, 0);

  const despesasItens = dre.porCategoria
    .filter((c) => !["receita_servico", "receita_pecas", "outras_receitas"].includes(c.grupo))
    .slice(0, 8)
    .map((c) => ({ label: c.categoria, value: c.valor, color: "bg-red-500" }));

  const pctFat = (v: number) => (dre.receitaBruta > 0 ? `${((v / dre.receitaBruta) * 100).toFixed(1).replace(".", ",")}% do faturamento` : "—");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Resultados" subtitle="Meta, faturamento, custos e lucro — mesma regra da DRE" />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href={`/resultados?mes=${deslocar(mes, -1)}`} className="btn-secondary px-2" aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="text-center">
          <p className="text-lg font-semibold text-slate-900">
            {MESES[mesNum - 1]} de {ano}
          </p>
          <div className="flex justify-center gap-3 text-xs">
            {mes !== mesAtual && (
              <Link href="/resultados" className="text-brand-700 hover:underline">
                mês atual
              </Link>
            )}
            <Link href={`/dre?ano=${ano}&mes=${mesNum}`} className="text-brand-700 hover:underline">
              DRE completa
            </Link>
          </div>
        </div>
        <Link href={`/resultados?mes=${deslocar(mes, 1)}`} className="btn-secondary px-2" aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Indicadores */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi
          titulo="Faturamento"
          valor={formatCurrency(dre.receitaBruta)}
          detalhe={`${dre.osConcluidas} OS concluída(s)`}
          variacao={variacao(dre.receitaBruta, anterior?.receitaBruta)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Kpi titulo="Recebido (caixa)" valor={formatCurrency(recebido)} detalhe="entrou no mês, líquido de taxas" icon={<Wallet className="h-4 w-4" />} />
        <Kpi
          titulo="Lucro líquido"
          valor={formatCurrency(dre.lucroLiquido)}
          detalhe={`margem ${dre.margemLiquida.toFixed(1).replace(".", ",")}%`}
          variacao={variacao(dre.lucroLiquido, anterior?.lucroLiquido)}
          tom={dre.lucroLiquido >= 0 ? "text-green-700" : "text-red-700"}
          icon={<PiggyBank className="h-4 w-4" />}
        />
        <Kpi titulo="Custo de peças" valor={formatCurrency(dre.custoPecas)} detalhe={pctFat(dre.custoPecas)} icon={<Package className="h-4 w-4" />} />
        <Kpi titulo="Gastos do técnico" valor={formatCurrency(totalCampo)} detalhe="combustível, alimentação…" icon={<Fuel className="h-4 w-4" />} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_340px]">
        {/* Gráfico */}
        <div className="card p-4">
          <h2 className="mb-2 font-semibold text-slate-900">Últimos 12 meses</h2>
          <GraficoResultado
            dados={serie.map(({ mk, d }) => ({
              label: `${CURTOS[Number(mk.slice(5)) - 1]}/${mk.slice(2, 4)}`,
              faturamento: d.receitaBruta,
              gastos: d.custos + d.despesas + d.impostos,
              lucro: d.lucroLiquido,
              meta: metaDe(mk) || null,
              destaque: mk === mes,
            }))}
          />
        </div>

        {/* Meta */}
        <div className="card p-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Target className="h-4 w-4 text-brand-600" /> Meta de faturamento
          </h2>
          {meta > 0 ? (
            <>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold text-slate-900">{ritmo.pct.toFixed(0)}%</p>
                <p className="text-sm text-slate-500">de {formatCurrency(meta)}</p>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${ritmo.pct >= 100 ? "bg-green-500" : ritmo.pctProjecao >= 100 ? "bg-brand-500" : "bg-amber-500"}`}
                  style={{ width: `${Math.min(100, ritmo.pct)}%` }}
                />
              </div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <Linha rotulo="Faturado" valor={formatCurrency(dre.receitaBruta)} />
                <Linha rotulo="Falta" valor={formatCurrency(ritmo.falta)} />
                {mes === mesAtual && ritmo.falta > 0 && (
                  <Linha rotulo={`Por dia (${ritmo.restantes} dias)`} valor={formatCurrency(ritmo.porDia)} />
                )}
                {mes === mesAtual && (
                  <Linha
                    rotulo="No ritmo atual, fecha em"
                    valor={`${formatCurrency(ritmo.projecao)} (${ritmo.pctProjecao.toFixed(0)}%)`}
                    cor={ritmo.pctProjecao >= 100 ? "text-green-700" : "text-amber-700"}
                  />
                )}
                <Linha rotulo="Aprovado a concluir" valor={formatCurrency(aRealizar.valor)} cor="text-slate-500" />
              </dl>
            </>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma meta definida para este mês.</p>
          )}
          <ActionForm action={salvarMeta} successMsg="Meta salva." className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
            <input type="hidden" name="ano" value={ano} />
            <input type="hidden" name="mes" value={mesNum} />
            <input name="valor" inputMode="decimal" defaultValue={meta || ""} placeholder="Meta do mês (R$)" className="input py-1.5 text-sm" />
            <button className="btn-secondary shrink-0 py-1.5 text-sm">{meta > 0 ? "Alterar" : "Definir"}</button>
          </ActionForm>
        </div>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {/* DRE resumida */}
        <div className="card p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Resultado do mês</h2>
          <dl className="space-y-1.5 text-sm">
            <Linha rotulo="Faturamento" valor={formatCurrency(dre.receitaBruta)} forte />
            <Linha rotulo="(−) Impostos" valor={formatCurrency(neg(dre.impostos))} cor="text-red-600" />
            <Linha rotulo="(−) Peças e terceiros" valor={formatCurrency(neg(dre.custos))} cor="text-red-600" />
            <Linha rotulo="(=) Lucro bruto" valor={formatCurrency(dre.lucroBruto)} forte separador />
            <Linha rotulo="(−) Operacionais" valor={formatCurrency(neg(dre.despesaOperacional))} cor="text-red-600" />
            <Linha rotulo="(−) Administrativas" valor={formatCurrency(neg(dre.despesaAdministrativa))} cor="text-red-600" />
            <Linha rotulo="(−) Financeiras e taxas" valor={formatCurrency(neg(dre.despesaFinanceira))} cor="text-red-600" />
            <Linha
              rotulo="(=) Lucro líquido"
              valor={formatCurrency(dre.lucroLiquido)}
              cor={dre.lucroLiquido >= 0 ? "text-green-700" : "text-red-700"}
              forte
              separador
            />
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            Margem bruta {dre.margemBruta.toFixed(1).replace(".", ",")}% • ticket médio {formatCurrency(dre.ticketMedio)}
          </p>
        </div>

        {/* Para onde foi o dinheiro */}
        <div className="card p-4">
          <h2 className="mb-3 font-semibold text-slate-900">Custos e despesas por categoria</h2>
          <HBarList items={despesasItens} formatValue={(v) => formatCurrency(v)} />
        </div>

        {/* Despesas do técnico */}
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Gastos do técnico em campo</h2>
            <Link href={`/financeiro/despesas-campo?mes=${mes}`} className="text-xs text-brand-700 hover:underline">
              detalhes
            </Link>
          </div>
          <HBarList items={campoItens} formatValue={(v) => formatCurrency(v)} />
          {totalCampo > 0 && <p className="mt-2 text-xs text-slate-500">{pctFat(totalCampo)}</p>}
        </div>
      </div>

      {/* Peças por OS */}
      <div className="card mb-4 overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Peças por OS concluída no mês</h2>
          <span className="text-xs text-slate-500">{dre.custoPorOs.length} OS com custo de peças</span>
        </div>
        {dre.custoPorOs.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma OS concluída com custo de peças neste mês.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="px-4 py-2 text-left font-medium">OS</th>
                <th className="px-4 py-2 text-right font-medium">Faturado</th>
                <th className="px-4 py-2 text-right font-medium">Peças</th>
                <th className="px-4 py-2 text-right font-medium">Margem</th>
                <th className="px-4 py-2 text-left font-medium">Origem do custo</th>
              </tr>
            </thead>
            <tbody>
              {dre.custoPorOs.slice(0, 15).map((o) => {
                const margem = o.receita > 0 ? ((o.receita - o.custo) / o.receita) * 100 : null;
                return (
                  <tr key={o.osId} className="border-t border-slate-50">
                    <td className="px-4 py-2">
                      <Link href={`/ordens/${o.osId}`} className="font-medium text-brand-700 hover:underline">
                        {formatNumeroOS(o.numero)}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right">{formatCurrency(o.receita)}</td>
                    <td className="px-4 py-2 text-right text-red-600">{formatCurrency(o.custo)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${margem != null && margem < 30 ? "text-amber-700" : "text-slate-800"}`}>
                      {margem != null ? `${margem.toFixed(0)}%` : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">{o.real ? "compra lançada em campo" : "custo do orçamento"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Faturamento e custo de peças contam no mês em que a OS foi concluída. “Recebido” é o dinheiro que entrou no mês (pode ser de
        serviços de outros meses). Detalhes em DRE completa.
      </p>
    </div>
  );
}

/** Valor de dedução: mostra "−R$ x" e nunca "−R$ 0,00". */
function neg(v: number): number {
  return v ? -v : 0;
}

function Kpi({
  titulo,
  valor,
  detalhe,
  variacao,
  icon,
  tom = "text-slate-900",
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  variacao?: number | null;
  icon?: React.ReactNode;
  tom?: string;
}) {
  return (
    <div className="card px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {icon}
        {titulo}
      </p>
      <p className={`mt-1 text-xl font-bold tracking-tight ${tom}`}>{valor}</p>
      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-slate-400">
        {detalhe && <span>{detalhe}</span>}
        {variacao != null && (
          <span className={variacao >= 0 ? "text-green-600" : "text-red-600"}>
            {variacao >= 0 ? "▲" : "▼"} {Math.abs(variacao).toFixed(0)}% vs mês anterior
          </span>
        )}
      </p>
    </div>
  );
}

function Linha({
  rotulo,
  valor,
  cor = "text-slate-900",
  forte,
  separador,
}: {
  rotulo: string;
  valor: string;
  cor?: string;
  forte?: boolean;
  separador?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-2 ${separador ? "border-t border-slate-100 pt-1.5" : ""}`}>
      <dt className={forte ? "font-semibold text-slate-800" : "text-slate-600"}>{rotulo}</dt>
      <dd className={`${forte ? "font-semibold" : ""} ${cor}`}>{valor}</dd>
    </div>
  );
}

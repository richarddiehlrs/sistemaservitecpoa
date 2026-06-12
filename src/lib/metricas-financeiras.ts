/** Métricas financeiras unificadas — competência (DRE) e caixa (realizado). */

export type LancamentoMetrica = {
  tipo: "receita" | "despesa";
  valor: number;
  valor_pago?: number | null;
  status?: string | null;
  categorias_financeiras?: { grupo_dre?: string | null } | null;
};

export type MetricasFinanceiras = {
  receita: number;
  custoDireto: number;
  despesas: number;
  lucroBruto: number;
  lucroLiquido: number;
  margemBruta: number;
  margemLiquida: number;
};

const GRUPOS_CUSTO_DIRETO = new Set(["custo_pecas", "custo_servico"]);
const GRUPOS_DESPESA = new Set([
  "despesa_operacional",
  "despesa_administrativa",
  "despesa_financeira",
  "impostos",
]);

function grupoDre(l: LancamentoMetrica): string {
  const g = l.categorias_financeiras?.grupo_dre;
  if (g) return g;
  return l.tipo === "receita" ? "outras_receitas" : "despesa_operacional";
}

function isAtivo(l: LancamentoMetrica): boolean {
  return l.status !== "cancelado";
}

function montar(receita: number, custoDireto: number, despesas: number): MetricasFinanceiras {
  const lucroBruto = Math.round((receita - custoDireto) * 100) / 100;
  const lucroLiquido = Math.round((lucroBruto - despesas) * 100) / 100;
  return {
    receita,
    custoDireto,
    despesas,
    lucroBruto,
    lucroLiquido,
    margemBruta: receita > 0 ? Math.round((lucroBruto / receita) * 1000) / 10 : 0,
    margemLiquida: receita > 0 ? Math.round((lucroLiquido / receita) * 1000) / 10 : 0,
  };
}

/** Regime de competência — usa valor nominal (faturamento do período). */
export function calcMetricasCompetencia(lancamentos: LancamentoMetrica[]): MetricasFinanceiras {
  let receita = 0;
  let custoDireto = 0;
  let despesas = 0;

  for (const l of lancamentos.filter(isAtivo)) {
    const v = Number(l.valor);
    const g = grupoDre(l);
    if (l.tipo === "receita") receita += v;
    if (GRUPOS_CUSTO_DIRETO.has(g)) custoDireto += v;
    else if (l.tipo === "despesa") despesas += v;
  }

  return montar(
    Math.round(receita * 100) / 100,
    Math.round(custoDireto * 100) / 100,
    Math.round(despesas * 100) / 100
  );
}

/** Regime de caixa — usa valor_pago (dinheiro que entrou/saiu). */
export function calcMetricasCaixa(lancamentos: LancamentoMetrica[]): MetricasFinanceiras {
  let receita = 0;
  let custoDireto = 0;
  let despesas = 0;

  for (const l of lancamentos.filter(isAtivo)) {
    const v = Number(l.valor_pago || 0);
    if (v <= 0) continue;
    const g = grupoDre(l);
    if (l.tipo === "receita") receita += v;
    if (GRUPOS_CUSTO_DIRETO.has(g)) custoDireto += v;
    else if (l.tipo === "despesa") despesas += v;
  }

  return montar(
    Math.round(receita * 100) / 100,
    Math.round(custoDireto * 100) / 100,
    Math.round(despesas * 100) / 100
  );
}

/** Lucro da OS a partir dos lançamentos vinculados (competência). */
export function calcLucroOs(lancamentos: LancamentoMetrica[]) {
  const ativos = lancamentos.filter(isAtivo);
  const receita = ativos
    .filter((l) => l.tipo === "receita")
    .reduce((s, l) => s + Number(l.valor), 0);
  const custo = ativos
    .filter((l) => l.tipo === "despesa" && GRUPOS_CUSTO_DIRETO.has(grupoDre(l)))
    .reduce((s, l) => s + Number(l.valor), 0);
  const despesasOs = ativos
    .filter((l) => l.tipo === "despesa" && !GRUPOS_CUSTO_DIRETO.has(grupoDre(l)))
    .reduce((s, l) => s + Number(l.valor), 0);
  const lucroBruto = Math.round((receita - custo) * 100) / 100;
  const lucroLiquido = Math.round((lucroBruto - despesasOs) * 100) / 100;
  return { receita, custo, despesasOs, lucroBruto, lucroLiquido };
}

// =====================================================================
// Resultado da empresa (DRE gerencial) — regra ÚNICA usada pela DRE,
// pelo painel de resultados, pela meta e pelos gráficos.
//
// Regras (regime de competência):
//  * Receita de OS e custo de peças da OS entram quando o serviço é
//    CONCLUÍDO (data de conclusão). OS aprovada e não concluída = "a realizar".
//  * Custo de peças da OS: se houver peça comprada em campo ligada à OS,
//    vale o custo REAL; senão vale o custo informado no orçamento (Custo OS-…).
//  * Demais receitas/despesas: data de competência do lançamento.
//  * Taxas da maquininha (retidas nos recebimentos): despesa financeira, pela
//    data do recebimento.
//  * Lançamentos cancelados não entram.
// =====================================================================

export type GrupoDre =
  | "receita_servico"
  | "receita_pecas"
  | "outras_receitas"
  | "impostos"
  | "custo_pecas"
  | "custo_servico"
  | "despesa_operacional"
  | "despesa_administrativa"
  | "despesa_financeira";

export type LancamentoBase = {
  id: string;
  tipo: "receita" | "despesa";
  valor: number;
  juros: number;
  multa: number;
  status: string;
  origem: string | null;
  descricao: string;
  data_competencia: string;
  os_id: string | null;
  categoria: string | null;
  grupo: GrupoDre | null;
};

export type OsBase = {
  id: string;
  numero: number;
  status: string;
  data_conclusao: string | null; // YYYY-MM-DD
};

export type TaxaBase = { data: string; valor: number };

export type LinhaCategoria = { categoria: string; grupo: GrupoDre; valor: number };

export type Dre = {
  receitaServico: number;
  receitaPecas: number;
  outrasReceitas: number;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  custoPecas: number;
  custoServico: number;
  custos: number;
  lucroBruto: number;
  despesaOperacional: number;
  despesaAdministrativa: number;
  despesaFinanceira: number;
  taxasCartao: number;
  despesas: number;
  lucroLiquido: number;
  margemBruta: number;
  margemLiquida: number;
  osConcluidas: number;
  ticketMedio: number;
  /** Despesas lançadas pelo celular (origem campo), exceto peças de OS. */
  despesasCampo: number;
  porCategoria: LinhaCategoria[];
  /** OS com custo de peças: real (campo) ou orçado. */
  custoPorOs: { osId: string; numero: number; custo: number; real: boolean; receita: number }[];
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const STATUS_CONCLUIDA = new Set(["concluida", "entregue"]);

function grupoDe(l: LancamentoBase): GrupoDre {
  if (l.grupo) return l.grupo;
  return l.tipo === "receita" ? "outras_receitas" : "despesa_operacional";
}

function ehCustoDeOs(l: LancamentoBase): boolean {
  const g = grupoDe(l);
  return Boolean(l.os_id) && l.tipo === "despesa" && (g === "custo_pecas" || g === "custo_servico");
}

function ehCustoOrcadoDoSistema(l: LancamentoBase): boolean {
  return l.origem !== "campo" && /^Custo OS-/i.test(l.descricao);
}

/**
 * Data em que o lançamento entra no resultado (ou null = fora: OS não concluída).
 */
export function dataNoResultado(l: LancamentoBase, os: Map<string, OsBase>): string | null {
  if (l.status === "cancelado") return null;
  if (l.os_id && (l.tipo === "receita" || ehCustoDeOs(l))) {
    const o = os.get(l.os_id);
    if (!o || !STATUS_CONCLUIDA.has(o.status) || !o.data_conclusao) return null;
    return o.data_conclusao.slice(0, 10);
  }
  return l.data_competencia;
}

/** Calcula a DRE do período [inicio, fim] (datas YYYY-MM-DD, inclusivas). */
export function calcularDre(
  lancamentos: LancamentoBase[],
  osLista: OsBase[],
  taxas: TaxaBase[],
  inicio: string,
  fim: string
): Dre {
  const os = new Map(osLista.map((o) => [o.id, o]));

  // OS com peça comprada em campo: o custo real substitui o orçado
  const osComCustoReal = new Set(
    lancamentos.filter((l) => ehCustoDeOs(l) && l.origem === "campo" && l.status !== "cancelado").map((l) => l.os_id!)
  );

  const soma: Record<GrupoDre, number> = {
    receita_servico: 0,
    receita_pecas: 0,
    outras_receitas: 0,
    impostos: 0,
    custo_pecas: 0,
    custo_servico: 0,
    despesa_operacional: 0,
    despesa_administrativa: 0,
    despesa_financeira: 0,
  };
  const porCat = new Map<string, LinhaCategoria>();
  const custoOs = new Map<string, { custo: number; real: boolean; receita: number }>();
  const osComReceita = new Set<string>();
  let despesasCampo = 0;

  for (const l of lancamentos) {
    const data = dataNoResultado(l, os);
    if (!data || data < inicio || data > fim) continue;
    if (ehCustoDeOs(l) && ehCustoOrcadoDoSistema(l) && osComCustoReal.has(l.os_id!)) continue;

    const g = grupoDe(l);
    const v = l.tipo === "receita" ? Number(l.valor) + Number(l.juros || 0) + Number(l.multa || 0) : Number(l.valor);
    soma[g] += v;

    const nomeCat = l.categoria ?? (l.tipo === "receita" ? "Outras receitas" : "Outras despesas");
    const c = porCat.get(nomeCat) ?? { categoria: nomeCat, grupo: g, valor: 0 };
    c.valor += v;
    porCat.set(nomeCat, c);

    if (l.os_id && l.tipo === "receita") {
      osComReceita.add(l.os_id);
      const e = custoOs.get(l.os_id) ?? { custo: 0, real: false, receita: 0 };
      e.receita += v;
      custoOs.set(l.os_id, e);
    }
    if (ehCustoDeOs(l)) {
      const e = custoOs.get(l.os_id!) ?? { custo: 0, real: false, receita: 0 };
      e.custo += v;
      e.real = e.real || l.origem === "campo";
      custoOs.set(l.os_id!, e);
    } else if (l.tipo === "despesa" && l.origem === "campo") {
      despesasCampo += v;
    }
  }

  const taxasCartao = r2(taxas.filter((t) => t.data >= inicio && t.data <= fim).reduce((s, t) => s + Number(t.valor), 0));
  if (taxasCartao > 0) {
    const c = porCat.get("Taxas de cartão (retidas)") ?? { categoria: "Taxas de cartão (retidas)", grupo: "despesa_financeira" as GrupoDre, valor: 0 };
    c.valor += taxasCartao;
    porCat.set(c.categoria, c);
  }

  const receitaServico = r2(soma.receita_servico);
  const receitaPecas = r2(soma.receita_pecas);
  const outrasReceitas = r2(soma.outras_receitas);
  const receitaBruta = r2(receitaServico + receitaPecas + outrasReceitas);
  const impostos = r2(soma.impostos);
  const receitaLiquida = r2(receitaBruta - impostos);
  const custoPecas = r2(soma.custo_pecas);
  const custoServico = r2(soma.custo_servico);
  const custos = r2(custoPecas + custoServico);
  const lucroBruto = r2(receitaLiquida - custos);
  const despesaOperacional = r2(soma.despesa_operacional);
  const despesaAdministrativa = r2(soma.despesa_administrativa);
  const despesaFinanceira = r2(soma.despesa_financeira + taxasCartao);
  const despesas = r2(despesaOperacional + despesaAdministrativa + despesaFinanceira);
  const lucroLiquido = r2(lucroBruto - despesas);
  const pct = (v: number) => (receitaBruta > 0 ? Math.round((v / receitaBruta) * 1000) / 10 : 0);

  const custoPorOs = [...custoOs.entries()]
    .filter(([, e]) => e.custo > 0)
    .map(([osId, e]) => ({ osId, numero: os.get(osId)?.numero ?? 0, custo: r2(e.custo), real: e.real, receita: r2(e.receita) }))
    .sort((a, b) => b.custo - a.custo);

  return {
    receitaServico,
    receitaPecas,
    outrasReceitas,
    receitaBruta,
    impostos,
    receitaLiquida,
    custoPecas,
    custoServico,
    custos,
    lucroBruto,
    despesaOperacional,
    despesaAdministrativa,
    despesaFinanceira,
    taxasCartao,
    despesas,
    lucroLiquido,
    margemBruta: pct(lucroBruto),
    margemLiquida: pct(lucroLiquido),
    osConcluidas: osComReceita.size,
    ticketMedio: osComReceita.size ? r2((receitaServico + receitaPecas) / osComReceita.size) : 0,
    despesasCampo: r2(despesasCampo),
    porCategoria: [...porCat.values()].map((c) => ({ ...c, valor: r2(c.valor) })).sort((a, b) => b.valor - a.valor),
    custoPorOs,
  };
}

/** Receita de OS aprovadas e ainda não concluídas (a realizar). */
export function receitaARealizar(lancamentos: LancamentoBase[], osLista: OsBase[]): { valor: number; qtd: number } {
  const os = new Map(osLista.map((o) => [o.id, o]));
  const ids = new Set<string>();
  let valor = 0;
  for (const l of lancamentos) {
    if (l.status === "cancelado" || l.tipo !== "receita" || !l.os_id) continue;
    const o = os.get(l.os_id);
    if (o && (STATUS_CONCLUIDA.has(o.status) || o.status === "cancelada")) continue;
    valor += Number(l.valor);
    ids.add(l.os_id);
  }
  return { valor: r2(valor), qtd: ids.size };
}

/** "2026-11" → primeiro/último dia. */
export function limitesMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

export function mesesAte(mesFinal: string, quantidade: number): string[] {
  const [a, m] = mesFinal.split("-").map(Number);
  return Array.from({ length: quantidade }).map((_, i) => {
    const d = new Date(Date.UTC(a, m - 1 - (quantidade - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * Ritmo da meta: quanto falta, quanto por dia até o fim do mês e projeção
 * mantendo o ritmo atual (dias corridos).
 */
export function ritmoMeta(opts: { meta: number; realizado: number; mes: string; hoje: string }) {
  const { inicio, fim } = limitesMes(opts.mes);
  const diasMes = Number(fim.slice(8));
  let decorridos: number;
  if (opts.hoje < inicio) decorridos = 0;
  else if (opts.hoje > fim) decorridos = diasMes;
  else decorridos = Number(opts.hoje.slice(8));
  const restantes = Math.max(0, diasMes - decorridos);
  const falta = Math.max(0, r2(opts.meta - opts.realizado));
  const projecao = decorridos > 0 ? r2((opts.realizado / decorridos) * diasMes) : 0;
  return {
    pct: opts.meta > 0 ? Math.round((opts.realizado / opts.meta) * 1000) / 10 : 0,
    falta,
    porDia: restantes > 0 ? r2(falta / restantes) : falta,
    restantes,
    projecao,
    pctProjecao: opts.meta > 0 ? Math.round((projecao / opts.meta) * 1000) / 10 : 0,
  };
}

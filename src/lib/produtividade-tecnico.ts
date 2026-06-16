/** Cálculos de comissão e lucro por técnico (funções puras). */

export function calcLucroOsSimples(valorTotal: number, custoTotal: number): number {
  return Math.round((Number(valorTotal) - Number(custoTotal || 0)) * 100) / 100;
}

export function calcComissaoTecnico(lucro: number, percentual: number): number {
  if (percentual <= 0 || lucro <= 0) return 0;
  return Math.round((lucro * percentual) / 100 * 100) / 100;
}

export type OsLucroInput = {
  id: string;
  tecnico: string | null;
  tecnico_id: string | null;
  valor_total: number;
  custo_total: number | null;
};

export type ProdutividadeLinha = {
  tecnicoId: string | null;
  nome: string;
  osConcluidas: number;
  visitasRealizadas: number;
  visitasPendentes: number;
  receita: number;
  lucro: number;
  comissao: number;
};

/** Agrupa lucro de OS concluídas por técnico. */
export function agruparLucroPorTecnico(
  ordens: OsLucroInput[],
  percentualComissao: number,
  resolverNome?: (o: OsLucroInput) => string
): ProdutividadeLinha[] {
  const mapa = new Map<string, ProdutividadeLinha>();

  for (const o of ordens) {
    const nome = resolverNome?.(o) ?? (o.tecnico?.trim() || "Sem técnico");
    const chave = o.tecnico_id || nome;
    const lucro = calcLucroOsSimples(o.valor_total, o.custo_total ?? 0);
    const receita = Number(o.valor_total) || 0;

    const atual = mapa.get(chave) ?? {
      tecnicoId: o.tecnico_id,
      nome,
      osConcluidas: 0,
      visitasRealizadas: 0,
      visitasPendentes: 0,
      receita: 0,
      lucro: 0,
      comissao: 0,
    };

    atual.osConcluidas += 1;
    atual.receita += receita;
    atual.lucro += lucro;
    mapa.set(chave, atual);
  }

  return [...mapa.values()]
    .map((t) => ({
      ...t,
      lucro: Math.round(t.lucro * 100) / 100,
      receita: Math.round(t.receita * 100) / 100,
      comissao: calcComissaoTecnico(t.lucro, percentualComissao),
    }))
    .sort((a, b) => b.lucro - a.lucro);
}

/** Conta visitas da agenda por técnico_id. */
export function contarVisitasAgenda(
  linhas: ProdutividadeLinha[],
  agendamentos: { tecnico_id: string | null; status: string }[]
): ProdutividadeLinha[] {
  const mapa = new Map(linhas.map((l) => [l.tecnicoId || l.nome, { ...l }]));

  for (const a of agendamentos) {
    const chave = a.tecnico_id || "";
    if (!chave) continue;
    let linha = mapa.get(chave);
    if (!linha) {
      linha = {
        tecnicoId: a.tecnico_id,
        nome: chave,
        osConcluidas: 0,
        visitasRealizadas: 0,
        visitasPendentes: 0,
        receita: 0,
        lucro: 0,
        comissao: 0,
      };
      mapa.set(chave, linha);
    }
    if (a.status === "realizado") linha.visitasRealizadas += 1;
    else if (["agendado", "confirmado", "em_atendimento"].includes(a.status)) {
      linha.visitasPendentes += 1;
    }
  }

  return [...mapa.values()].sort((a, b) => b.lucro - a.lucro);
}

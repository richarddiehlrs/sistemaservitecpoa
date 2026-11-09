// Sugestões de conciliação: liga linhas do extrato aos pagamentos registrados no sistema.

export type PagamentoParaConciliar = {
  id: string;
  valor: number;
  data: string; // YYYY-MM-DD
  tipoLancamento: "receita" | "despesa";
  contaId: string | null;
  descricao: string;
  forma: string | null;
};

export type TransacaoParaConciliar = {
  id: string;
  data: string;
  valor: number; // + entrada / - saída
  contaId: string;
};

export type Sugestao = {
  pagamentoIds: string[];
  soma: number;
  /** soma - |valor do banco|: > 0 indica taxa retida (maquininha). */
  diferenca: number;
  pontos: number;
  motivo: string;
};

const DIA = 86_400_000;

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DIA);
}

function compativel(tx: TransacaoParaConciliar, p: PagamentoParaConciliar): boolean {
  return tx.valor > 0 ? p.tipoLancamento === "receita" : p.tipoLancamento === "despesa";
}

/**
 * Pontua candidatos para uma transação.
 * - valor exato e data próxima (−3 a +5 dias) → sugestão forte
 * - maquininha: o banco recebe até 10% a menos (taxa) e até 32 dias depois
 * - vários pagamentos do mesmo dia somando o valor (repasse em lote)
 */
export function sugerirConciliacao(
  tx: TransacaoParaConciliar,
  pagamentos: PagamentoParaConciliar[],
  opts: { maquininha?: boolean; limite?: number } = {}
): Sugestao[] {
  const alvo = Math.abs(tx.valor);
  const janelaMax = opts.maquininha ? 32 : 5;
  const candidatos = pagamentos.filter((p) => {
    if (!compativel(tx, p)) return false;
    const d = diasEntre(p.data, tx.data); // banco depois do sistema = positivo
    return d >= -3 && d <= janelaMax;
  });

  const bonusConta = (p: PagamentoParaConciliar) =>
    p.contaId === tx.contaId ? 15 : p.contaId ? -25 : 0;

  const sugestoes: Sugestao[] = [];

  for (const p of candidatos) {
    const dif = Math.round((p.valor - alvo) * 100) / 100;
    const dias = Math.abs(diasEntre(p.data, tx.data));
    if (Math.abs(dif) <= 0.01) {
      sugestoes.push({
        pagamentoIds: [p.id],
        soma: p.valor,
        diferenca: 0,
        pontos: 100 - dias * 6 + bonusConta(p),
        motivo: dias === 0 ? "Mesmo valor e mesma data" : `Mesmo valor, ${dias} dia(s) de diferença`,
      });
    } else if (opts.maquininha && dif > 0 && dif <= p.valor * 0.1) {
      sugestoes.push({
        pagamentoIds: [p.id],
        soma: p.valor,
        diferenca: dif,
        pontos: 70 - dias * 1.5 - (dif / p.valor) * 100 + bonusConta(p),
        motivo: `Valor menos taxa de ${((dif / p.valor) * 100).toFixed(1)}%`,
      });
    }
  }

  // Lote: combinação de até 6 pagamentos que soma exatamente o valor
  const lote = candidatos
    .filter((p) => p.valor < alvo)
    .sort((a, b) => Math.abs(diasEntre(a.data, tx.data)) - Math.abs(diasEntre(b.data, tx.data)))
    .slice(0, 16);
  const combo = acharSoma(lote, Math.round(alvo * 100), 6);
  if (combo && combo.length > 1) {
    const soma = combo.reduce((s, p) => s + p.valor, 0);
    sugestoes.push({
      pagamentoIds: combo.map((p) => p.id),
      soma: Math.round(soma * 100) / 100,
      diferenca: 0,
      pontos: 60 - combo.length * 3,
      motivo: `${combo.length} pagamentos somam o valor do banco`,
    });
  }

  return sugestoes.sort((a, b) => b.pontos - a.pontos).slice(0, opts.limite ?? 5);
}

/** Busca combinação (em centavos) que soma exatamente o alvo. */
function acharSoma<T extends { valor: number }>(itens: T[], alvoCent: number, maxItens: number): T[] | null {
  const cent = itens.map((i) => Math.round(i.valor * 100));
  let passos = 0;
  const escolha: number[] = [];
  function dfs(inicio: number, resto: number): boolean {
    if (resto === 0) return escolha.length > 0;
    if (escolha.length >= maxItens || ++passos > 20_000) return false;
    for (let i = inicio; i < itens.length; i++) {
      if (cent[i] > resto) continue;
      escolha.push(i);
      if (dfs(i + 1, resto - cent[i])) return true;
      escolha.pop();
    }
    return false;
  }
  return dfs(0, alvoCent) ? escolha.map((i) => itens[i]) : null;
}

/**
 * Conciliação automática segura: só quando há UM pagamento com valor exato,
 * até 3 dias de diferença, e esse pagamento não serve para outra transação.
 */
export function paresAutomaticos(
  txs: TransacaoParaConciliar[],
  pagamentos: PagamentoParaConciliar[]
): { transacaoId: string; pagamentoId: string }[] {
  const porTx = new Map<string, PagamentoParaConciliar[]>();
  const usoPagamento = new Map<string, number>();

  for (const tx of txs) {
    const exatos = pagamentos.filter(
      (p) =>
        compativel(tx, p) &&
        Math.abs(p.valor - Math.abs(tx.valor)) <= 0.01 &&
        Math.abs(diasEntre(p.data, tx.data)) <= 3 &&
        (p.contaId == null || p.contaId === tx.contaId)
    );
    porTx.set(tx.id, exatos);
    for (const p of exatos) usoPagamento.set(p.id, (usoPagamento.get(p.id) ?? 0) + 1);
  }

  const pares: { transacaoId: string; pagamentoId: string }[] = [];
  for (const tx of txs) {
    const exatos = porTx.get(tx.id) ?? [];
    if (exatos.length === 1 && usoPagamento.get(exatos[0].id) === 1) {
      pares.push({ transacaoId: tx.id, pagamentoId: exatos[0].id });
    }
  }
  return pares;
}

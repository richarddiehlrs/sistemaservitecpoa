import { saldoEmAberto } from "@/lib/financeiro";

/** Título em aberto (pendente/parcial) usado na projeção. */
export type TituloAberto = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  valor_pago: number;
  juros: number;
  multa: number;
  data_vencimento: string | null;
};

export type Periodo = { key: string; label: string };

export type ProjecaoLinha = Periodo & {
  entradas: number;
  saidas: number;
  resultado: number;
  saldo: number;
};

export type ResumoAtraso = {
  receber: number;
  pagar: number;
  qtdReceber: number;
  qtdPagar: number;
  /** Mais antigo primeiro. */
  itens: (TituloAberto & { saldo: number; diasAtraso: number })[];
};

const DIA = 86_400_000;

function dias(a: string, b: string): number {
  return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DIA);
}

/**
 * Separa títulos em aberto em:
 *  - atrasados (vencimento antes de hoje) → NÃO entram na projeção por padrão,
 *    porque não há garantia de que vão entrar/sair (muitos já foram pagos sem registro);
 *  - futuros (vence hoje ou depois) → distribuídos no período do vencimento.
 * Títulos sem vencimento ficam de fora da projeção.
 */
export function projetarFluxo(opts: {
  titulos: TituloAberto[];
  periodos: Periodo[];
  /** YYYY-MM-DD */
  hoje: string;
  caixaAtual: number;
  /** Converte a data de vencimento na chave do período (mês ou semana). */
  chaveDe: (vencimento: string) => string;
  /** true = soma os atrasados no primeiro período (visão pessimista/otimista antiga). */
  incluirAtrasados?: boolean;
}): { linhas: ProjecaoLinha[]; atraso: ResumoAtraso; semVencimento: number } {
  const bucket = new Map(opts.periodos.map((p) => [p.key, { entradas: 0, saidas: 0 }]));
  const primeiro = opts.periodos[0]?.key;
  const atraso: ResumoAtraso = { receber: 0, pagar: 0, qtdReceber: 0, qtdPagar: 0, itens: [] };
  let semVencimento = 0;

  for (const t of opts.titulos) {
    const saldo = saldoEmAberto(t);
    if (saldo <= 0) continue;
    if (!t.data_vencimento) {
      semVencimento++;
      continue;
    }

    let key: string | undefined;
    if (t.data_vencimento < opts.hoje) {
      if (t.tipo === "receita") {
        atraso.receber += saldo;
        atraso.qtdReceber++;
      } else {
        atraso.pagar += saldo;
        atraso.qtdPagar++;
      }
      atraso.itens.push({ ...t, saldo, diasAtraso: dias(t.data_vencimento, opts.hoje) });
      if (!opts.incluirAtrasados) continue;
      key = primeiro;
    } else {
      key = opts.chaveDe(t.data_vencimento);
    }

    const b = key ? bucket.get(key) : undefined;
    if (!b) continue;
    if (t.tipo === "receita") b.entradas += saldo;
    else b.saidas += saldo;
  }

  let acumulado = opts.caixaAtual;
  const linhas = opts.periodos.map((p) => {
    const b = bucket.get(p.key)!;
    const entradas = Math.round(b.entradas * 100) / 100;
    const saidas = Math.round(b.saidas * 100) / 100;
    const resultado = Math.round((entradas - saidas) * 100) / 100;
    acumulado = Math.round((acumulado + resultado) * 100) / 100;
    return { ...p, entradas, saidas, resultado, saldo: acumulado };
  });

  atraso.receber = Math.round(atraso.receber * 100) / 100;
  atraso.pagar = Math.round(atraso.pagar * 100) / 100;
  atraso.itens.sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
  return { linhas, atraso, semVencimento };
}

/** Uma linha do extrato bancário, já normalizada. */
export type TransacaoExtrato = {
  /** YYYY-MM-DD */
  data: string;
  /** Positivo = entrada (crédito); negativo = saída (débito). */
  valor: number;
  descricao: string;
  documento?: string | null;
  /** Identificador estável para não importar duas vezes (FITID ou hash). */
  chave: string;
};

export type ResultadoExtrato = {
  formato: "ofx" | "csv" | "pdf";
  transacoes: TransacaoExtrato[];
  periodoInicio?: string | null;
  periodoFim?: string | null;
  saldoFinal?: number | null;
  /** Avisos para o usuário conferir antes de importar. */
  avisos: string[];
};

/** Arredonda para centavos sem erro de ponto flutuante acumulado. */
export function centavos(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Converte "1.234,56", "-1234.56", "1,234.56", "R$ 10,00", "10,00-" ou "(10,00)" em número.
 * Retorna NaN quando não reconhece.
 */
export function parseValorBr(raw: string): number {
  let s = String(raw ?? "").trim();
  if (!s) return NaN;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/R\$\s?/gi, "").replace(/\s/g, "");
  if (s.endsWith("-")) {
    negativo = true;
    s = s.slice(0, -1);
  }
  if (s.startsWith("-")) {
    negativo = !negativo;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s)) return NaN;

  const ultVirgula = s.lastIndexOf(",");
  const ultPonto = s.lastIndexOf(".");
  if (ultVirgula > ultPonto) {
    // vírgula decimal (padrão BR)
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (ultPonto > ultVirgula && ultVirgula >= 0) {
    // ponto decimal com vírgula de milhar
    s = s.replace(/,/g, "");
  } else if (ultPonto >= 0 && ultVirgula < 0) {
    // só ponto: decimal se tiver 1-2 casas no fim, senão milhar
    const casas = s.length - ultPonto - 1;
    if (casas === 3 && (s.match(/\./g) || []).length >= 1 && !/^0\./.test(s)) {
      s = s.replace(/\./g, "");
    }
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return centavos(negativo ? -n : n);
}

/** "31/12/2026", "31/12/26", "2026-12-31", "20261231" → "2026-12-31". */
export function parseDataBr(raw: string, anoPadrao?: number): string | null {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const dia = m[1].padStart(2, "0");
    const mes = m[2].padStart(2, "0");
    let ano = m[3] ? Number(m[3]) : anoPadrao;
    if (!ano) return null;
    if (ano < 100) ano += 2000;
    if (Number(mes) < 1 || Number(mes) > 12 || Number(dia) < 1 || Number(dia) > 31) return null;
    return `${ano}-${mes}-${dia}`;
  }
  return null;
}

/** Normaliza descrição (espaços, maiúsculas) para chave/ comparação. */
export function normalizarDescricao(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Gera chaves estáveis para linhas sem FITID: data|valor|descrição|n,
 * onde n diferencia linhas idênticas no mesmo arquivo (ex.: duas tarifas iguais no dia).
 */
export function atribuirChaves(
  linhas: Omit<TransacaoExtrato, "chave">[]
): TransacaoExtrato[] {
  const contagem = new Map<string, number>();
  return linhas.map((l) => {
    const base = `${l.data}|${l.valor.toFixed(2)}|${normalizarDescricao(l.descricao)}`;
    const n = (contagem.get(base) ?? 0) + 1;
    contagem.set(base, n);
    return { ...l, chave: `h:${base}|${n}` };
  });
}

export function periodoDe(txs: TransacaoExtrato[]): { inicio: string | null; fim: string | null } {
  if (!txs.length) return { inicio: null, fim: null };
  const datas = txs.map((t) => t.data).sort();
  return { inicio: datas[0], fim: datas[datas.length - 1] };
}

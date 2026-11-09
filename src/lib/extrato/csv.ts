import {
  atribuirChaves,
  normalizarDescricao,
  parseDataBr,
  parseValorBr,
  periodoDe,
  type ResultadoExtrato,
  type TransacaoExtrato,
} from "./tipos";

function detectarSeparador(linha: string): string {
  const cont = (c: string) => linha.split(c).length - 1;
  const opcoes = [";", ",", "\t"].map((c) => [c, cont(c)] as const);
  opcoes.sort((a, b) => b[1] - a[1]);
  return opcoes[0][1] > 0 ? opcoes[0][0] : ";";
}

/** Divide uma linha CSV respeitando aspas. */
export function dividirCsv(linha: string, sep: string): string[] {
  const out: string[] = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      if (aspas && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else {
        aspas = !aspas;
      }
    } else if (c === sep && !aspas) {
      out.push(atual.trim());
      atual = "";
    } else {
      atual += c;
    }
  }
  out.push(atual.trim());
  return out;
}

type Colunas = {
  data: number;
  descricao: number[];
  valor: number;
  credito: number;
  debito: number;
  documento: number;
  tipo: number;
};

function mapearColunas(cab: string[]): Colunas | null {
  const n = cab.map((c) => normalizarDescricao(c));
  const achar = (re: RegExp, excluir?: RegExp) =>
    n.findIndex((c) => re.test(c) && !(excluir && excluir.test(c)));

  const data = achar(/^DATA|^DATE|^DT\b|DATA DA (VENDA|TRANSACAO|OPERACAO)|DATA DE PAGAMENTO/);
  if (data < 0) return null;

  // InfinitePay e maquininhas: preferir o valor LÍQUIDO (o que cai na conta)
  let valor = achar(/VALOR LIQUIDO|LIQUIDO/);
  if (valor < 0) valor = achar(/^VALOR|^AMOUNT|^MONTANTE|^QUANTIA/, /BRUTO|TAXA|SALDO/);
  if (valor < 0) valor = achar(/^VALOR|^AMOUNT/, /SALDO/);

  const credito = achar(/CREDITO|ENTRADA/, /CARTAO|TIPO/);
  const debito = achar(/DEBITO|SAIDA/, /CARTAO|TIPO/);
  const documento = achar(/^DOC|DOCUMENTO|^ID\b|IDENTIFICADOR|NSU|CODIGO DA TRANSACAO/);
  const tipo = achar(/^TIPO|NATUREZA|^OPERACAO/);

  const descricao = [
    achar(/DESCRI/),
    achar(/HISTORICO|LANCAMENTO|DETALHE|ESTABELECIMENTO|NOME|PAGADOR|CLIENTE/),
    tipo,
  ].filter((i, idx, arr) => i >= 0 && arr.indexOf(i) === idx && i !== data);

  if (valor < 0 && credito < 0 && debito < 0) return null;
  return { data, descricao, valor, credito, debito, documento, tipo };
}

const RE_SAIDA = /SAIDA|DEBITO|ENVIAD|PAGAMENTO|TARIFA|TAXA|SAQUE|ESTORNO DE VENDA|CHARGEBACK|TRANSFERENCIA ENVIADA/;

/** CSV genérico de banco/maquininha (InfinitePay, Bradesco, planilhas). */
export function parseCsv(texto: string): ResultadoExtrato {
  const avisos: string[] = [];
  const linhas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return { formato: "csv", transacoes: [], avisos: ["Arquivo vazio."] };

  let idxCab = -1;
  let cols: Colunas | null = null;
  let sep = ";";
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    sep = detectarSeparador(linhas[i]);
    cols = mapearColunas(dividirCsv(linhas[i], sep));
    if (cols) {
      idxCab = i;
      break;
    }
  }
  if (!cols || idxCab < 0) {
    return {
      formato: "csv",
      transacoes: [],
      avisos: ["Não encontrei as colunas de data e valor. Verifique se o arquivo tem cabeçalho (Data, Descrição, Valor)."],
    };
  }

  const anoPadrao = new Date().getFullYear();
  const brutas: Omit<TransacaoExtrato, "chave">[] = [];
  let ignoradas = 0;

  for (const linha of linhas.slice(idxCab + 1)) {
    const c = dividirCsv(linha, sep);
    const data = parseDataBr(c[cols.data] ?? "", anoPadrao);
    if (!data) {
      ignoradas++;
      continue;
    }

    let valor = NaN;
    if (cols.valor >= 0) {
      valor = parseValorBr(c[cols.valor] ?? "");
      const tipoTxt = cols.tipo >= 0 ? normalizarDescricao(c[cols.tipo] ?? "") : "";
      if (Number.isFinite(valor) && valor > 0 && tipoTxt && RE_SAIDA.test(tipoTxt)) valor = -valor;
    }
    if (!Number.isFinite(valor) || valor === 0) {
      const cr = cols.credito >= 0 ? parseValorBr(c[cols.credito] ?? "") : NaN;
      const db = cols.debito >= 0 ? parseValorBr(c[cols.debito] ?? "") : NaN;
      if (Number.isFinite(cr) && cr !== 0) valor = Math.abs(cr);
      else if (Number.isFinite(db) && db !== 0) valor = -Math.abs(db);
    }
    if (!Number.isFinite(valor) || valor === 0) {
      ignoradas++;
      continue;
    }

    const descricao =
      cols.descricao.map((i) => c[i]).filter(Boolean).join(" — ") || "Transação";
    const documento = cols.documento >= 0 ? c[cols.documento] || null : null;
    brutas.push({ data, valor, descricao, documento });
  }

  if (ignoradas > 0) avisos.push(`${ignoradas} linha(s) sem data ou valor foram ignoradas (ex.: saldo, totais).`);

  const transacoes = atribuirChaves(brutas).map((t) =>
    t.documento ? { ...t, chave: `doc:${t.data}|${t.documento}|${t.valor.toFixed(2)}` } : t
  );
  const p = periodoDe(transacoes);
  return { formato: "csv", transacoes, periodoInicio: p.inicio, periodoFim: p.fim, saldoFinal: null, avisos };
}

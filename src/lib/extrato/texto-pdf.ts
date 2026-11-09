import {
  atribuirChaves,
  centavos,
  normalizarDescricao,
  parseDataBr,
  parseValorBr,
  periodoDe,
  type ResultadoExtrato,
  type TransacaoExtrato,
} from "./tipos";

// Valor monetário BR: "1.234,56", "- R$ 10,00", "+R$ 5,00", "10,00-"
const RE_VALOR = /([+-])?\s?(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})(-)?(?!\d)/g;
const RE_DATA_INICIO = /^\s*(\d{2}\/\d{2}(?:\/\d{2,4})?)\b/;
const RE_SALDO = /\bSALDO\b|SDO\s|SALDO ANTERIOR|SALDO DO DIA|SALDO FINAL|SALDO DISPONIVEL|S A L D O/;
const RE_IGNORAR = /^(DATA|HISTORICO|LANCAMENTO|DESCRICAO|DOCTO|EXTRATO|AGENCIA|CONTA|PAGINA|TOTAL|PERIODO|CLIENTE|NOME)\b/;
const RE_SAIDA =
  /DEBITO|PAGTO|PAGAMENTO|PGTO|TARIFA|ENVIAD|ENVIO|SAQUE|COMPRA|\bIOF\b|JUROS|TAXA|MENSALIDADE|ANUIDADE|TRANSF(ERENCIA)? ENVIADA|CESTA|APLICACAO|DOC\/TED ENV|TED ENV|BOLETO PAGO/;
const RE_ENTRADA =
  /RECEBID|CREDITO|DEPOSITO|VENDA|ESTORNO|RESGATE|TED REC|DOC REC|RENDIMENTO|ANTECIPACAO|LIQUIDACAO/;

type Pendente = Omit<TransacaoExtrato, "chave"> & { incerto: boolean };

/**
 * Interpreta o TEXTO de um extrato em PDF (Bradesco, InfinitePay e outros).
 * PDF não tem padrão — é uma leitura aproximada: usa a coluna de saldo para
 * descobrir se é entrada ou saída e, sem saldo, palavras-chave.
 */
export function parseExtratoTexto(linhasPdf: string[]): ResultadoExtrato {
  const avisos: string[] = [];
  const textoTudo = linhasPdf.join("\n");
  const anoMatch = textoTudo.match(/\b\d{2}\/\d{2}\/(\d{4})\b/);
  const anoPadrao = anoMatch ? Number(anoMatch[1]) : new Date().getFullYear();

  const txs: Pendente[] = [];
  let dataAtual: string | null = null;
  let saldoAnterior: number | null = null;
  let saldoFinal: number | null = null;
  let incertas = 0;

  for (const original of linhasPdf) {
    let linha = original.replace(/\s+/g, " ").trim();
    if (!linha) continue;
    const norm = normalizarDescricao(linha);
    if (RE_IGNORAR.test(norm) && !RE_DATA_INICIO.test(linha)) continue;

    const mData = linha.match(RE_DATA_INICIO);
    if (mData) {
      const d = parseDataBr(mData[1], anoPadrao);
      if (d) dataAtual = d;
      linha = linha.slice(mData[0].length).trim();
    }

    const valores: { v: number; explicito: boolean; bruto: string }[] = [];
    for (const m of linha.matchAll(RE_VALOR)) {
      const base = parseValorBr(m[2]);
      if (!Number.isFinite(base)) continue;
      const neg = m[1] === "-" || m[3] === "-";
      valores.push({ v: neg ? -base : base, explicito: Boolean(m[1] || m[3]), bruto: m[0] });
    }

    const normSemValores = normalizarDescricao(linha);
    if (RE_SALDO.test(normSemValores)) {
      if (valores.length) {
        saldoAnterior = valores[valores.length - 1].v;
        saldoFinal = saldoAnterior;
      }
      continue;
    }

    if (!valores.length) {
      // Linha de complemento (ex.: nome do pagador do PIX) → junta na anterior
      const ultima = txs[txs.length - 1];
      if (ultima && !mData && linha.length > 2 && ultima.descricao.length < 140) {
        ultima.descricao = `${ultima.descricao} ${linha}`.trim();
      }
      continue;
    }
    if (!dataAtual) continue;

    let descricao = linha;
    for (const v of valores) descricao = descricao.replace(v.bruto, " ");
    let documento: string | null = null;
    const mDoc = descricao.match(/\b(\d{5,})\b/);
    if (mDoc) {
      documento = mDoc[1];
      descricao = descricao.replace(mDoc[0], " ");
    }
    descricao = descricao.replace(/\s+/g, " ").trim() || "Transação";

    let valor: number;
    let incerto = false;
    if (valores.length >= 2) {
      // Penúltimo = valor do lançamento; último = saldo após o lançamento
      const valorAbs = Math.abs(valores[valores.length - 2].v);
      const saldoDepois = valores[valores.length - 1].v;
      if (saldoAnterior != null && Math.abs(Math.abs(saldoDepois - saldoAnterior) - valorAbs) < 0.011) {
        valor = saldoDepois >= saldoAnterior ? valorAbs : -valorAbs;
      } else if (valores[valores.length - 2].explicito) {
        valor = valores[valores.length - 2].v;
      } else {
        valor = sinalPorPalavra(normalizarDescricao(descricao), valorAbs);
        incerto = !RE_SAIDA.test(normalizarDescricao(descricao)) && !RE_ENTRADA.test(normalizarDescricao(descricao));
      }
      saldoAnterior = saldoDepois;
      saldoFinal = saldoDepois;
    } else {
      const unico = valores[0];
      if (unico.explicito) {
        valor = unico.v;
      } else {
        valor = sinalPorPalavra(normalizarDescricao(descricao), Math.abs(unico.v));
        incerto = !RE_SAIDA.test(normalizarDescricao(descricao)) && !RE_ENTRADA.test(normalizarDescricao(descricao));
      }
      if (saldoAnterior != null) saldoAnterior = centavos(saldoAnterior + valor);
    }

    if (valor === 0) continue;
    if (incerto) incertas++;
    txs.push({ data: dataAtual, valor: centavos(valor), descricao, documento, incerto });
  }

  avisos.push("Extrato em PDF é lido por aproximação: confira a data, o valor e se é entrada ou saída antes de importar. Sempre que possível, use o arquivo OFX do banco.");
  if (incertas > 0) {
    avisos.push(`${incertas} linha(s) sem indicação clara de entrada/saída foram marcadas como entrada — revise.`);
  }
  if (!txs.length) avisos.push("Não encontrei lançamentos neste PDF. Ele pode ser uma imagem escaneada — exporte o OFX ou CSV no banco.");

  const transacoes = atribuirChaves(txs.map(({ incerto: _i, ...t }) => t));
  const p = periodoDe(transacoes);
  return { formato: "pdf", transacoes, periodoInicio: p.inicio, periodoFim: p.fim, saldoFinal, avisos };
}

function sinalPorPalavra(desc: string, valorAbs: number): number {
  if (RE_SAIDA.test(desc) && !/RECEBID|ESTORNO/.test(desc)) return -valorAbs;
  return valorAbs;
}

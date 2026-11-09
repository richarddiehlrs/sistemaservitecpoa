import {
  centavos,
  parseDataBr,
  parseValorBr,
  periodoDe,
  type ResultadoExtrato,
  type TransacaoExtrato,
} from "./tipos";

/** Decodifica bytes do OFX respeitando CHARSET (Bradesco costuma usar 1252). */
export function decodificarOfx(bytes: Uint8Array): string {
  const cabecalho = new TextDecoder("latin1").decode(bytes.slice(0, 600));
  const utf8 = /ENCODING:\s*UTF-?8|encoding="utf-8"/i.test(cabecalho);
  try {
    return new TextDecoder(utf8 ? "utf-8" : "windows-1252").decode(bytes);
  } catch {
    return new TextDecoder("latin1").decode(bytes);
  }
}

/** Lê uma tag OFX (SGML sem fechamento ou XML com fechamento). */
function tag(bloco: string, nome: string): string | null {
  const re = new RegExp(`<${nome}>([^<\\r\\n]*)`, "i");
  const m = bloco.match(re);
  return m ? m[1].trim() : null;
}

export function ehOfx(texto: string): boolean {
  return /OFXHEADER|<OFX>/i.test(texto.slice(0, 2000));
}

/** Interpreta OFX 1.x (SGML) e 2.x (XML) — padrão exportado por todos os bancos. */
export function parseOfx(texto: string): ResultadoExtrato {
  const avisos: string[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const transacoes: TransacaoExtrato[] = [];
  const usadas = new Map<string, number>();

  for (const raw of blocos) {
    const bloco = raw.split(/<\/STMTTRN>/i)[0];
    const data = parseDataBr(tag(bloco, "DTPOSTED") ?? "");
    const valor = parseValorBr(tag(bloco, "TRNAMT") ?? "");
    if (!data || !Number.isFinite(valor) || valor === 0) continue;

    const memo = tag(bloco, "MEMO");
    const nome = tag(bloco, "NAME");
    const descricao = [nome, memo].filter(Boolean).join(" — ") || tag(bloco, "TRNTYPE") || "Transação";
    const documento = tag(bloco, "CHECKNUM") || tag(bloco, "REFNUM");
    let fitid = tag(bloco, "FITID") || `${data}|${valor.toFixed(2)}|${descricao}`;
    // Alguns bancos repetem FITID dentro do mesmo arquivo
    const n = (usadas.get(fitid) ?? 0) + 1;
    usadas.set(fitid, n);
    if (n > 1) fitid = `${fitid}#${n}`;

    transacoes.push({
      data,
      valor: centavos(valor),
      descricao,
      documento,
      chave: `ofx:${fitid}`,
    });
  }

  if (!transacoes.length) avisos.push("Nenhuma transação encontrada no arquivo OFX.");

  const balBloco = texto.split(/<LEDGERBAL>/i)[1] ?? "";
  const saldo = balBloco ? parseValorBr(tag(balBloco, "BALAMT") ?? "") : NaN;
  const p = periodoDe(transacoes);

  return {
    formato: "ofx",
    transacoes,
    periodoInicio: parseDataBr(tag(texto, "DTSTART") ?? "") ?? p.inicio,
    periodoFim: parseDataBr(tag(texto, "DTEND") ?? "") ?? p.fim,
    saldoFinal: Number.isFinite(saldo) ? saldo : null,
    avisos,
  };
}

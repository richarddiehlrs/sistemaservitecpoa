import { parseCsv } from "./csv";
import { decodificarOfx, ehOfx, parseOfx } from "./ofx";
import { parseExtratoTexto } from "./texto-pdf";
import type { ResultadoExtrato } from "./tipos";

export type { ResultadoExtrato, TransacaoExtrato } from "./tipos";

/** Extrai linhas de texto de um PDF agrupando os pedaços pela altura (linha da tabela). */
export async function linhasDoPdf(bytes: Uint8Array): Promise<string[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const linhas: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const conteudo = await page.getTextContent();
    const porY = new Map<number, { x: number; s: string }[]>();
    for (const item of conteudo.items as { str?: string; transform?: number[] }[]) {
      if (!item.str || !item.transform) continue;
      const y = Math.round(item.transform[5] / 2) * 2; // tolerância de 2pt
      const x = item.transform[4];
      const arr = porY.get(y) ?? [];
      arr.push({ x, s: item.str });
      porY.set(y, arr);
    }
    const ys = [...porY.keys()].sort((a, b) => b - a); // de cima para baixo
    for (const y of ys) {
      const partes = porY.get(y)!.sort((a, b) => a.x - b.x).map((i) => i.s.trim()).filter(Boolean);
      if (partes.length) linhas.push(partes.join(" "));
    }
  }
  return linhas;
}

/** Detecta o formato pelo nome/conteúdo e devolve as transações para conferência. */
export async function lerExtrato(nomeArquivo: string, bytes: Uint8Array): Promise<ResultadoExtrato> {
  const nome = nomeArquivo.toLowerCase();
  const inicio = new TextDecoder("latin1").decode(bytes.slice(0, 8));

  if (nome.endsWith(".pdf") || inicio.startsWith("%PDF")) {
    const linhas = await linhasDoPdf(bytes);
    return parseExtratoTexto(linhas);
  }

  const textoOfx = decodificarOfx(bytes);
  if (nome.endsWith(".ofx") || nome.endsWith(".qfx") || ehOfx(textoOfx)) {
    return parseOfx(textoOfx);
  }

  // CSV: tenta UTF-8; se aparecer caractere inválido, usa Windows-1252 (Excel BR)
  let texto = new TextDecoder("utf-8").decode(bytes);
  if (texto.includes("�")) texto = new TextDecoder("windows-1252").decode(bytes);
  return parseCsv(texto);
}

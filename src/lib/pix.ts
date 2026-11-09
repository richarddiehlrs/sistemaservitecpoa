/** Chave PIX (CNPJ) e link de avaliação Google — ServitecPoa */
export const PIX_CHAVE_CNPJ = "56001021000186";
export const GOOGLE_REVIEW_URL = "https://g.page/r/CZwp7-qsY0l3EBM/review";

function tlv(id: string, value: string): string {
  return id + value.length.toString().padStart(2, "0") + value;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Só A-Z, 0-9 e espaço (o padrão EMV/BR Code não aceita acentos nem símbolos). */
function textoPix(v: string, max: number, padrao: string): string {
  const t = v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return t || padrao;
}

/**
 * Gera o "PIX copia e cola" (BR Code estático, padrão do Banco Central).
 * Campos: 00 formato, 26 conta (GUI + chave), 52 MCC, 53 moeda, 54 valor,
 * 58 país, 59 nome, 60 cidade, 62 txid (obrigatório; "***" = sem identificador), 63 CRC.
 */
export function pixCopiaCola(opts: {
  chave?: string;
  nome: string;
  cidade?: string;
  valor?: number;
  /** Identificador do pagamento (até 25 letras/números). Padrão "***". */
  txid?: string;
}): string {
  const chave = (opts.chave || PIX_CHAVE_CNPJ).replace(/\D/g, "");
  const nome = textoPix(opts.nome, 25, "SERVITECPOA");
  const cidade = textoPix(opts.cidade || "", 15, "PORTO ALEGRE");
  const txid = (opts.txid || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";

  let payload = tlv("00", "01");
  payload += tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", chave));
  payload += tlv("52", "0000");
  payload += tlv("53", "986");
  if (opts.valor != null && Number.isFinite(opts.valor) && opts.valor > 0) {
    payload += tlv("54", opts.valor.toFixed(2));
  }
  payload += tlv("58", "BR");
  payload += tlv("59", nome);
  payload += tlv("60", cidade);
  payload += tlv("62", tlv("05", txid));
  payload += "6304";
  return payload + crc16(payload);
}

/** Confere estrutura (TLV) e CRC de um PIX copia e cola. Usado em testes. */
export function validarPix(payload: string): { ok: boolean; campos: Record<string, string>; erro?: string } {
  const campos: Record<string, string> = {};
  let i = 0;
  while (i < payload.length) {
    const id = payload.slice(i, i + 2);
    const len = Number(payload.slice(i + 2, i + 4));
    if (!/^\d{2}$/.test(id) || !Number.isFinite(len)) return { ok: false, campos, erro: `TLV inválido na posição ${i}` };
    campos[id] = payload.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  if (i !== payload.length) return { ok: false, campos, erro: "Tamanho inconsistente" };
  const crcEsperado = crc16(payload.slice(0, -4));
  if (campos["63"] !== crcEsperado) return { ok: false, campos, erro: `CRC ${campos["63"]} ≠ ${crcEsperado}` };
  for (const obrig of ["00", "26", "52", "53", "58", "59", "60", "62", "63"]) {
    if (!campos[obrig]) return { ok: false, campos, erro: `Campo ${obrig} ausente` };
  }
  return { ok: true, campos };
}

/** Exposto para testes contra o exemplo oficial do Banco Central. */
export const _crc16 = crc16;

export function formatPixCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

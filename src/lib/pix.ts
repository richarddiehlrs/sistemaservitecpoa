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

/** Gera payload PIX (copia e cola) para QR estático ou com valor. */
export function pixCopiaCola(opts: {
  chave?: string;
  nome: string;
  cidade?: string;
  valor?: number;
}): string {
  const chave = (opts.chave || PIX_CHAVE_CNPJ).replace(/\D/g, "");
  const nome = opts.nome.substring(0, 25).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cidade = (opts.cidade || "PORTO ALEGRE").substring(0, 15).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const gui = tlv("00", "br.gov.bcb.pix");
  const chaveTlv = tlv("01", chave);
  const merchantAccount = tlv("26", gui + chaveTlv);

  let payload = tlv("00", "01");
  payload += merchantAccount;
  payload += tlv("52", "0000");
  payload += tlv("53", "986");
  if (opts.valor != null && opts.valor > 0) {
    payload += tlv("54", opts.valor.toFixed(2));
  }
  payload += tlv("58", "BR");
  payload += tlv("59", nome);
  payload += tlv("60", cidade);
  payload += "6304";
  return payload + crc16(payload);
}

export function formatPixCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

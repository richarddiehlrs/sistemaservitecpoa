import { describe, expect, it } from "vitest";
import { _crc16, pixCopiaCola, validarPix } from "./pix";
import { qrImageUrl } from "./qrcode";

describe("PIX copia e cola (BR Code)", () => {
  it("CRC bate com o exemplo oficial do Manual do BR Code (Banco Central)", () => {
    const exemplo =
      "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
    expect(_crc16(exemplo)).toBe("1D3D");
    expect(validarPix(exemplo + "1D3D").ok).toBe(true);
  });

  it("gera código válido com a chave CNPJ da ServitecPoa, valor e txid obrigatório", () => {
    const p = pixCopiaCola({ nome: "ServitecPoa Assistência Técnica", cidade: "Porto Alegre/RS", valor: 1980 });
    const v = validarPix(p);
    expect(v.erro).toBeUndefined();
    expect(v.ok).toBe(true);
    expect(v.campos["26"]).toBe("0014br.gov.bcb.pix011456001021000186");
    expect(v.campos["54"]).toBe("1980.00");
    expect(v.campos["59"]).toBe("SERVITECPOA ASSISTENCIA T");
    expect(v.campos["60"]).toBe("PORTO ALEGRE RS");
    expect(v.campos["62"]).toBe("0503***");
  });

  it("sem valor (QR estático aberto) e com caracteres especiais no nome", () => {
    const v = validarPix(pixCopiaCola({ nome: "Serviço & Cia — Ltda.", cidade: "" }));
    expect(v.ok).toBe(true);
    expect(v.campos["54"]).toBeUndefined();
    expect(v.campos["59"]).toBe("SERVICO CIA LTDA");
    expect(v.campos["60"]).toBe("PORTO ALEGRE");
  });

  it("txid personalizado vira só letras e números", () => {
    const v = validarPix(pixCopiaCola({ nome: "X", txid: "OS-00130" }));
    expect(v.campos["62"]).toBe("0507OS00130");
  });

  it("QR é gerado localmente em SVG", () => {
    const url = qrImageUrl(pixCopiaCola({ nome: "ServitecPoa", valor: 10 }), 90);
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(url)).toContain("<path d=\"M");
  });
});

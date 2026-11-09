import { describe, expect, it } from "vitest";
import { parseOfx, decodificarOfx } from "./ofx";
import { parseCsv } from "./csv";
import { parseExtratoTexto } from "./texto-pdf";
import { parseValorBr, parseDataBr } from "./tipos";
import { paresAutomaticos, sugerirConciliacao } from "../conciliacao";

describe("parseValorBr", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["-1.234,56", -1234.56],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["R$ 10,00", 10],
    ["10,00-", -10],
    ["(25,90)", -25.9],
    ["-12.90", -12.9],
    ["1.500", 1500],
  ])("%s → %d", (raw, esperado) => {
    expect(parseValorBr(raw)).toBe(esperado);
  });
  it("texto inválido vira NaN", () => expect(parseValorBr("abc")).toBeNaN());
});

describe("parseDataBr", () => {
  it("formatos comuns", () => {
    expect(parseDataBr("05/11/2026")).toBe("2026-11-05");
    expect(parseDataBr("05/11/26")).toBe("2026-11-05");
    expect(parseDataBr("20261105120000[-3:BRT]")).toBe("2026-11-05");
    expect(parseDataBr("05/11", 2026)).toBe("2026-11-05");
    expect(parseDataBr("32/13/2026")).toBeNull();
  });
});

const OFX_BRADESCO = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>0237<ACCTID>12345</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20261101000000[-03:EST]
<DTEND>20261130000000[-03:EST]
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261103000000[-03:EST]
<TRNAMT>350.00
<FITID>20261103001
<CHECKNUM>1234567
<MEMO>PIX RECEBIDO MARIA SILVA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261104000000[-03:EST]
<TRNAMT>-12,90
<FITID>20261104001
<MEMO>TARIFA BANCARIA CESTA
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>1337.10<DTASOF>20261130</LEDGERBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("OFX", () => {
  it("lê OFX SGML do Bradesco", () => {
    const r = parseOfx(OFX_BRADESCO);
    expect(r.transacoes).toHaveLength(2);
    expect(r.transacoes[0]).toMatchObject({
      data: "2026-11-03",
      valor: 350,
      descricao: "PIX RECEBIDO MARIA SILVA",
      documento: "1234567",
      chave: "ofx:20261103001",
    });
    expect(r.transacoes[1].valor).toBe(-12.9);
    expect(r.periodoInicio).toBe("2026-11-01");
    expect(r.periodoFim).toBe("2026-11-30");
    expect(r.saldoFinal).toBe(1337.1);
  });

  it("decodifica acentos em Windows-1252", () => {
    const bytes = new Uint8Array([...new TextEncoder().encode("OFXHEADER:100\nCHARSET:1252\n<MEMO>PAGTO "), 0xc7, 0xc3, 0x4f]);
    expect(decodificarOfx(bytes)).toContain("PAGTO ÇÃO");
  });

  it("FITID repetido no mesmo arquivo não colide", () => {
    const dup = OFX_BRADESCO.replace("<FITID>20261104001", "<FITID>20261103001");
    const r = parseOfx(dup);
    expect(new Set(r.transacoes.map((t) => t.chave)).size).toBe(2);
  });
});

describe("CSV", () => {
  it("InfinitePay: usa valor líquido e tipo", () => {
    const csv = [
      "Data;Tipo;Descrição;Valor bruto;Taxa;Valor líquido;Identificador",
      '02/11/2026;Venda;"Crédito 2x";200,00;9,98;190,02;abc123',
      "03/11/2026;Transferência enviada;Saque para conta;500,00;0,00;500,00;def456",
    ].join("\n");
    const r = parseCsv(csv);
    expect(r.transacoes).toHaveLength(2);
    expect(r.transacoes[0]).toMatchObject({ data: "2026-11-02", valor: 190.02, documento: "abc123" });
    expect(r.transacoes[1].valor).toBe(-500);
  });

  it("colunas crédito/débito separadas", () => {
    const csv = "Data,Histórico,Crédito,Débito,Saldo\n05/11/2026,PIX RECEBIDO,150.00,,1150.00\n06/11/2026,TARIFA,,9.90,1140.10";
    const r = parseCsv(csv);
    expect(r.transacoes.map((t) => t.valor)).toEqual([150, -9.9]);
  });

  it("linhas idênticas recebem chaves diferentes", () => {
    const csv = "Data;Descrição;Valor\n05/11/2026;TARIFA;-5,00\n05/11/2026;TARIFA;-5,00";
    const r = parseCsv(csv);
    expect(r.transacoes[0].chave).not.toBe(r.transacoes[1].chave);
  });

  it("sem cabeçalho reconhecível avisa", () => {
    expect(parseCsv("a;b\n1;2").avisos[0]).toMatch(/colunas/);
  });
});

describe("PDF (texto)", () => {
  it("Bradesco: sinal pelo saldo e linha de complemento", () => {
    const linhas = [
      "Extrato de: Agência: 1234 Conta: 56789-0",
      "Data Histórico Docto. Crédito (R$) Débito (R$) Saldo (R$)",
      "01/11/2026 SALDO ANTERIOR 1.000,00",
      "03/11/2026 PIX RECEBIDO 1234567 350,00 1.350,00",
      "REM: MARIA SILVA",
      "TARIFA BANCARIA 12,90 1.337,10",
      "05/11/2026 PAGTO ELETRON COBRANCA 990001 200,00 1.137,10",
    ];
    const r = parseExtratoTexto(linhas);
    expect(r.transacoes).toHaveLength(3);
    expect(r.transacoes[0]).toMatchObject({ data: "2026-11-03", valor: 350, documento: "1234567" });
    expect(r.transacoes[0].descricao).toContain("MARIA SILVA");
    expect(r.transacoes[1]).toMatchObject({ data: "2026-11-03", valor: -12.9 });
    expect(r.transacoes[2]).toMatchObject({ data: "2026-11-05", valor: -200 });
    expect(r.saldoFinal).toBe(1137.1);
  });

  it("InfinitePay: sinal explícito", () => {
    const r = parseExtratoTexto([
      "02/11/2026 Venda no crédito + R$ 190,02",
      "03/11/2026 Transferência para Bradesco - R$ 500,00",
    ]);
    expect(r.transacoes.map((t) => t.valor)).toEqual([190.02, -500]);
  });
});

describe("conciliação", () => {
  const conta = "c-brad";
  const pg = (id: string, valor: number, data: string, tipo: "receita" | "despesa" = "receita", contaId: string | null = conta) => ({
    id, valor, data, tipoLancamento: tipo, contaId, descricao: id, forma: "PIX",
  });

  it("valor exato com data próxima é a melhor sugestão", () => {
    const s = sugerirConciliacao({ id: "t", data: "2026-11-03", valor: 350, contaId: conta }, [
      pg("longe", 350, "2026-10-20"),
      pg("perto", 350, "2026-11-02"),
      pg("outro", 351, "2026-11-03"),
    ]);
    expect(s[0].pagamentoIds).toEqual(["perto"]);
    expect(s.find((x) => x.pagamentoIds.includes("longe"))).toBeUndefined();
  });

  it("maquininha: aceita taxa e prazo maior", () => {
    const s = sugerirConciliacao({ id: "t", data: "2026-11-30", valor: 190.02, contaId: conta }, [pg("venda", 200, "2026-11-01")], { maquininha: true });
    expect(s[0].pagamentoIds).toEqual(["venda"]);
    expect(s[0].diferenca).toBe(9.98);
  });

  it("lote: vários pagamentos somam o depósito", () => {
    const s = sugerirConciliacao({ id: "t", data: "2026-11-04", valor: 450, contaId: conta }, [
      pg("a", 100, "2026-11-03"), pg("b", 150, "2026-11-03"), pg("c", 200, "2026-11-03"), pg("d", 75, "2026-11-03"),
    ]);
    const lote = s.find((x) => x.pagamentoIds.length > 1);
    expect(lote?.soma).toBe(450);
  });

  it("saída do banco não sugere receita", () => {
    expect(sugerirConciliacao({ id: "t", data: "2026-11-03", valor: -350, contaId: conta }, [pg("r", 350, "2026-11-03")])).toHaveLength(0);
  });

  it("automático só quando não há ambiguidade", () => {
    const pares = paresAutomaticos(
      [
        { id: "t1", data: "2026-11-03", valor: 350, contaId: conta },
        { id: "t2", data: "2026-11-05", valor: 80, contaId: conta },
        { id: "t3", data: "2026-11-05", valor: 80, contaId: conta },
      ],
      [pg("p1", 350, "2026-11-03"), pg("p2", 80, "2026-11-05")]
    );
    expect(pares).toEqual([{ transacaoId: "t1", pagamentoId: "p1" }]);
  });
});

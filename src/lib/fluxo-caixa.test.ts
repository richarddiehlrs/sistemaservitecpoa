import { describe, expect, it } from "vitest";
import { projetarFluxo, type TituloAberto } from "./fluxo-caixa";

const t = (p: Partial<TituloAberto>): TituloAberto => ({
  id: Math.random().toString(36),
  tipo: "receita",
  descricao: "x",
  valor: 100,
  valor_pago: 0,
  juros: 0,
  multa: 0,
  data_vencimento: "2026-11-20",
  ...p,
});

const periodos = [
  { key: "2026-11", label: "Nov" },
  { key: "2026-12", label: "Dez" },
];
const base = { periodos, hoje: "2026-11-08", caixaAtual: 1000, chaveDe: (v: string) => v.slice(0, 7) };

describe("projetarFluxo", () => {
  it("atrasados ficam fora da projeção e aparecem no resumo", () => {
    const r = projetarFluxo({
      ...base,
      titulos: [
        t({ valor: 500, data_vencimento: "2026-06-30" }),
        t({ tipo: "despesa", valor: 290, data_vencimento: "2026-07-01" }),
        t({ valor: 300, data_vencimento: "2026-11-20" }),
      ],
    });
    expect(r.linhas[0].entradas).toBe(300);
    expect(r.linhas[0].saidas).toBe(0);
    expect(r.atraso).toMatchObject({ receber: 500, pagar: 290, qtdReceber: 1, qtdPagar: 1 });
    expect(r.atraso.itens[0].diasAtraso).toBe(131);
  });

  it("opção incluir atrasados soma no primeiro período", () => {
    const r = projetarFluxo({ ...base, incluirAtrasados: true, titulos: [t({ valor: 500, data_vencimento: "2026-06-30" })] });
    expect(r.linhas[0].entradas).toBe(500);
  });

  it("usa só o saldo em aberto (parcial) e acumula a partir do caixa atual", () => {
    const r = projetarFluxo({
      ...base,
      titulos: [
        t({ valor: 1000, valor_pago: 600, data_vencimento: "2026-12-05" }),
        t({ tipo: "despesa", valor: 250, data_vencimento: "2026-11-08" }),
      ],
    });
    expect(r.linhas.map((l) => [l.entradas, l.saidas, l.saldo])).toEqual([
      [0, 250, 750],
      [400, 0, 1150],
    ]);
  });

  it("vencimento hoje não é atraso; sem vencimento e quitados ficam de fora", () => {
    const r = projetarFluxo({
      ...base,
      titulos: [t({ data_vencimento: "2026-11-08" }), t({ data_vencimento: null }), t({ valor_pago: 100 })],
    });
    expect(r.atraso.qtdReceber).toBe(0);
    expect(r.semVencimento).toBe(1);
    expect(r.linhas[0].entradas).toBe(100);
  });

  it("vencimento depois do horizonte não entra", () => {
    const r = projetarFluxo({ ...base, titulos: [t({ data_vencimento: "2027-03-01" })] });
    expect(r.linhas.reduce((s, l) => s + l.entradas, 0)).toBe(0);
  });
});

import { extratoMes } from "./fluxo-caixa";

describe("extratoMes", () => {
  const m = (id: string, data: string, tipo: "receita" | "despesa", valor: number, taxa = 0) => ({
    id, data, tipo, valor, taxa, descricao: id, categoria: null, conta: null, lancamentoId: null,
  });

  it("saldo a partir do saldo inicial, entrada líquida de taxa e dias do mais recente para o mais antigo", () => {
    const r = extratoMes(
      [m("a", "2026-11-03", "receita", 200, 5), m("b", "2026-11-03", "despesa", 50), m("c", "2026-11-05", "receita", 100)],
      1000
    );
    expect(r.entradas).toBe(295);
    expect(r.saidas).toBe(50);
    expect(r.taxas).toBe(5);
    expect(r.resultado).toBe(245);
    expect(r.saldoFinal).toBe(1245);
    expect(r.dias.map((d) => [d.data, d.saldo])).toEqual([
      ["2026-11-05", 1245],
      ["2026-11-03", 1145],
    ]);
  });

  it("sem saldo inicial mostra o acumulado do mês a partir de zero", () => {
    const r = extratoMes([m("x", "2026-11-01", "despesa", 30)], null);
    expect(r.saldoFinal).toBe(-30);
    expect(r.dias[0].saidas).toBe(30);
  });
});

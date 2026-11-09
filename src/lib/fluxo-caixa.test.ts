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

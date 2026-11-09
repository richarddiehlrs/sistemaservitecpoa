import { describe, expect, it } from "vitest";
import { calcularDre, receitaARealizar, ritmoMeta, mesesAte, type LancamentoBase, type OsBase } from "./resultado";

let n = 0;
const l = (p: Partial<LancamentoBase>): LancamentoBase => ({
  id: `l${++n}`,
  tipo: "despesa",
  valor: 0,
  juros: 0,
  multa: 0,
  status: "pago",
  origem: "sistema",
  descricao: "x",
  data_competencia: "2026-11-05",
  os_id: null,
  categoria: null,
  grupo: null,
  ...p,
});

const os: OsBase[] = [
  { id: "os1", numero: 1, status: "concluida", data_conclusao: "2026-11-10" },
  { id: "os2", numero: 2, status: "aprovada", data_conclusao: null },
  { id: "os3", numero: 3, status: "entregue", data_conclusao: "2026-10-28" },
];

describe("calcularDre", () => {
  it("receita e custo da OS entram na conclusão; OS não concluída fica de fora", () => {
    const dre = calcularDre(
      [
        l({ tipo: "receita", valor: 1000, os_id: "os1", grupo: "receita_servico", data_competencia: "2026-09-01" }),
        l({ tipo: "receita", valor: 800, os_id: "os2", grupo: "receita_servico" }),
        l({ tipo: "receita", valor: 500, os_id: "os3", grupo: "receita_servico", data_competencia: "2026-11-02" }),
        l({ valor: 300, os_id: "os1", grupo: "custo_pecas", descricao: "Custo OS-00001", data_competencia: "2026-09-01" }),
      ],
      os,
      [],
      "2026-11-01",
      "2026-11-30"
    );
    expect(dre.receitaBruta).toBe(1000);
    expect(dre.custoPecas).toBe(300);
    expect(dre.lucroBruto).toBe(700);
    expect(dre.osConcluidas).toBe(1);
    expect(dre.ticketMedio).toBe(1000);
  });

  it("peça comprada em campo substitui o custo orçado da mesma OS (sem contar duas vezes)", () => {
    const dre = calcularDre(
      [
        l({ tipo: "receita", valor: 1000, os_id: "os1", grupo: "receita_servico" }),
        l({ valor: 300, os_id: "os1", grupo: "custo_pecas", descricao: "Custo OS-00001" }),
        l({ valor: 180, os_id: "os1", grupo: "custo_pecas", origem: "campo", descricao: "Peças / material — capacitor" }),
      ],
      os,
      [],
      "2026-11-01",
      "2026-11-30"
    );
    expect(dre.custoPecas).toBe(180);
    expect(dre.custoPorOs[0]).toMatchObject({ osId: "os1", custo: 180, real: true, receita: 1000 });
  });

  it("despesas por competência, taxas da maquininha como financeira e despesas de campo separadas", () => {
    const dre = calcularDre(
      [
        l({ tipo: "receita", valor: 2000, grupo: "receita_servico" }),
        l({ valor: 250, origem: "campo", grupo: "despesa_operacional", categoria: "Combustível / deslocamento" }),
        l({ valor: 1100, grupo: "despesa_administrativa", categoria: "Aluguel" }),
        l({ valor: 90, grupo: "impostos", categoria: "Impostos (Simples Nacional)" }),
        l({ valor: 999, status: "cancelado", grupo: "despesa_administrativa" }),
        l({ valor: 500, grupo: "despesa_administrativa", data_competencia: "2026-10-31" }),
      ],
      os,
      [{ data: "2026-11-15", valor: 40 }, { data: "2026-12-01", valor: 99 }],
      "2026-11-01",
      "2026-11-30"
    );
    expect(dre.receitaLiquida).toBe(1910);
    expect(dre.despesaOperacional).toBe(250);
    expect(dre.despesaAdministrativa).toBe(1100);
    expect(dre.taxasCartao).toBe(40);
    expect(dre.despesaFinanceira).toBe(40);
    expect(dre.lucroLiquido).toBe(1910 - 250 - 1100 - 40);
    expect(dre.despesasCampo).toBe(250);
    expect(dre.margemLiquida).toBe(26);
    expect(dre.porCategoria.find((c) => c.categoria === "Aluguel")?.valor).toBe(1100);
  });
});

describe("apoio", () => {
  it("receita a realizar = OS aprovadas não concluídas", () => {
    expect(
      receitaARealizar([l({ tipo: "receita", valor: 800, os_id: "os2" }), l({ tipo: "receita", valor: 1000, os_id: "os1" })], os)
    ).toEqual({ valor: 800, qtd: 1 });
  });

  it("ritmo da meta", () => {
    const r = ritmoMeta({ meta: 30000, realizado: 10000, mes: "2026-11", hoje: "2026-11-10" });
    expect(r.pct).toBe(33.3);
    expect(r.falta).toBe(20000);
    expect(r.restantes).toBe(20);
    expect(r.porDia).toBe(1000);
    expect(r.projecao).toBe(30000);
  });

  it("últimos meses", () => {
    expect(mesesAte("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  calcPrejuizoGarantiaPeriodo,
  osDentroGarantia,
  podeAbrirRetornoGarantia,
} from "@/lib/os-garantia";

describe("os-garantia", () => {
  it("dentro do prazo de garantia", () => {
    const conclusao = new Date();
    conclusao.setDate(conclusao.getDate() - 10);
    expect(
      osDentroGarantia({ data_conclusao: conclusao.toISOString(), garantia_dias: 90 })
    ).toBe(true);
  });

  it("prejuízo = custo − receita paga", () => {
    const osIds = new Set(["os1"]);
    const r = calcPrejuizoGarantiaPeriodo(
      [
        {
          os_id: "os1",
          tipo: "despesa",
          valor: 150,
          status: "pendente",
          categorias_financeiras: { grupo_dre: "custo_garantia" },
        },
        {
          os_id: "os1",
          tipo: "receita",
          valor: 50,
          valor_pago: 0,
          status: "pendente",
        },
      ],
      osIds
    );
    expect(r.prejuizo).toBe(150);
  });

  it("bloqueia retorno se já é retorno", () => {
    const r = podeAbrirRetornoGarantia({
      status: "concluida",
      motivo_atendimento: "retorno_garantia",
      data_conclusao: new Date().toISOString(),
      garantia_dias: 90,
    } as never);
    expect(r.ok).toBe(false);
  });
});

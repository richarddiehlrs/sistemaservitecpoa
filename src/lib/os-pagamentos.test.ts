import { describe, expect, it } from "vitest";
import { calcValorSinal, calcSaldoRestanteOs } from "@/lib/os-pagamentos";

describe("calcValorSinal", () => {
  it("calcula 50% de 400", () => {
    expect(calcValorSinal(400, 50)).toBe(200);
  });

  it("calcula 30% de 1000", () => {
    expect(calcValorSinal(1000, 30)).toBe(300);
  });

  it("retorna 0 para saldo zero", () => {
    expect(calcValorSinal(0, 50)).toBe(0);
  });
});

describe("calcSaldoRestanteOs", () => {
  it("desconta pagamentos do saldo cliente", () => {
    expect(calcSaldoRestanteOs(500, 200)).toBe(300);
  });

  it("nunca fica negativo", () => {
    expect(calcSaldoRestanteOs(100, 150)).toBe(0);
  });
});

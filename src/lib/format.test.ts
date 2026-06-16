import { describe, expect, it } from "vitest";
import { parseNumForm } from "@/lib/format";

describe("parseNumForm", () => {
  it("interpreta input type=number com ponto decimal", () => {
    expect(parseNumForm("56.00")).toBe(56);
    expect(parseNumForm("56.5")).toBe(56.5);
  });

  it("interpreta formato brasileiro com vírgula", () => {
    expect(parseNumForm("56,00")).toBe(56);
    expect(parseNumForm("1.234,56")).toBe(1234.56);
  });

  it("retorna 0 para vazio ou inválido", () => {
    expect(parseNumForm(null)).toBe(0);
    expect(parseNumForm("")).toBe(0);
    expect(parseNumForm("abc")).toBe(0);
  });
});

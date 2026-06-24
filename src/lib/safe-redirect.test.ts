import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("aceita caminho relativo interno", () => {
    expect(safeRedirectPath("/financeiro")).toBe("/financeiro");
  });

  it("bloqueia URL externa", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.com/path")).toBe("/dashboard");
  });

  it("usa fallback para vazio", () => {
    expect(safeRedirectPath("")).toBe("/dashboard");
    expect(safeRedirectPath(null, "/campo")).toBe("/campo");
  });
});

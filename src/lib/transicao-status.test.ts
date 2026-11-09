import { describe, expect, it } from "vitest";
import { efeitosMudancaStatus, transicoesPermitidas, transicoesSugeridas, validarTransicaoStatus, TODOS_STATUS } from "./transicao-status";

describe("mudança de status", () => {
  it("administrador pode corrigir para qualquer status, com o fluxo normal primeiro", () => {
    const lista = transicoesPermitidas("concluida", "admin");
    expect(lista.slice(0, 2)).toEqual(transicoesSugeridas("concluida"));
    expect(new Set(lista)).toEqual(new Set(TODOS_STATUS.filter((s) => s !== "concluida")));
    expect(() => validarTransicaoStatus("concluida", "em_execucao", "admin")).not.toThrow();
    expect(() => validarTransicaoStatus("cancelada", "aprovada", "atendente")).not.toThrow();
  });

  it("técnico continua com o fluxo restrito", () => {
    expect(() => validarTransicaoStatus("concluida", "em_execucao", "tecnico")).toThrow();
    expect(transicoesPermitidas("em_roteiro", "tecnico")).toEqual(["em_execucao"]);
  });

  it("efeitos explicados antes de confirmar", () => {
    expect(efeitosMudancaStatus("em_execucao", "concluida", true)[0]).toMatch(/receita/);
    expect(efeitosMudancaStatus("concluida", "em_execucao", true)[0]).toMatch(/sai do faturamento/);
    expect(efeitosMudancaStatus("aprovada", "cancelada", true)[0]).toMatch(/Pagamentos já recebidos são mantidos/);
    expect(efeitosMudancaStatus("cancelada", "aprovada", true).join(" ")).toMatch(/sem duplicar/);
    expect(efeitosMudancaStatus("aguardando_aprovacao", "aprovada", false)[0]).toMatch(/aprovado/);
  });
});

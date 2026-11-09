import { describe, expect, it } from "vitest";
import { efeitoEtapa, etapasDisponiveis, ORDEM_ETAPAS, type ContextoEtapa } from "./etapas-os";
import { validarTransicaoStatus } from "./transicao-status";
import type { StatusOS } from "@/types/database";

const c = (p: Partial<ContextoEtapa>): ContextoEtapa => ({ status: "em_execucao", aprovado: false, local: "cliente", tipoAtendimento: "domicilio", ...p });

describe("etapas da OS", () => {
  it("visita em execução sem aprovação: coletar, diagnóstico, pedir peça", () => {
    expect(etapasDisponiveis(c({}))).toEqual(["coletado_oficina", "diagnostico", "peca_solicitada", "testes"]);
  });

  it("coletado em visita sem aprovação vai para análise na oficina", () => {
    expect(efeitoEtapa("coletado_oficina", c({}))).toEqual({ status: "em_analise", local: "oficina" });
    expect(efeitoEtapa("coletado_oficina", c({ status: "aguardando_aprovacao" }))).toEqual({ status: null, local: "oficina" });
  });

  it("aguardando peça: só peça recebida (e coleta se ainda no cliente)", () => {
    expect(etapasDisponiveis(c({ status: "aguardando_peca", aprovado: true, local: "oficina", tipoAtendimento: "oficina" }))).toEqual([
      "peca_recebida",
      "reparo_iniciado",
    ]);
  });

  it("concluída na oficina: saiu para entrega e entregue", () => {
    expect(etapasDisponiveis(c({ status: "concluida", aprovado: true, local: "oficina" }))).toEqual(["saiu_entrega", "entregue"]);
    expect(efeitoEtapa("entregue", c({ status: "concluida" }))).toEqual({ status: "entregue", local: "entregue" });
  });

  it("finalizada não tem etapas", () => {
    expect(etapasDisponiveis(c({ status: "entregue" }))).toEqual([]);
    expect(etapasDisponiveis(c({ status: "cancelada" }))).toEqual([]);
  });

  it("toda etapa oferecida leva a uma transição de status permitida pelo sistema", () => {
    const statuses: StatusOS[] = ["aberta", "em_analise", "aguardando_aprovacao", "aprovada", "em_roteiro", "em_execucao", "aguardando_peca", "cliente_ausente", "concluida"];
    for (const status of statuses) {
      for (const aprovado of [true, false]) {
        for (const local of ["cliente", "oficina", "transito"] as const) {
          const ctx = c({ status, aprovado, local });
          for (const e of etapasDisponiveis(ctx)) {
            const alvo = efeitoEtapa(e, ctx).status;
            if (alvo && alvo !== status) {
              expect(() => validarTransicaoStatus(status, alvo, "admin", { sistema: true }), `${status}→${alvo} (${e})`).not.toThrow();
            }
          }
        }
      }
    }
    expect(ORDEM_ETAPAS).toHaveLength(10);
  });
});

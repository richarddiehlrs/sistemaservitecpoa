import { describe, expect, it } from "vitest";
import { statusAposAprovacao, calcValorAprovadoOs } from "@/lib/aprovacao-os";
import { calcValorTotalCliente } from "@/lib/os-valores";
import {
  agruparLucroPorTecnico,
  calcComissaoTecnico,
  calcLucroOsSimples,
} from "@/lib/produtividade-tecnico";
import {
  statusPermiteCheckin,
  statusPosCheckout,
  validarTransicaoStatus,
} from "@/lib/transicao-status";

describe("statusPosCheckout", () => {
  it("visita sem aprovação vai para aguardando_aprovacao", () => {
    expect(
      statusPosCheckout(
        { status: "em_execucao", aprovado: false, tipo_atendimento: "domicilio" },
        "visita"
      )
    ).toBe("aguardando_aprovacao");
  });

  it("visita com OS já aprovada volta para aprovada", () => {
    expect(
      statusPosCheckout(
        { status: "em_execucao", aprovado: true, tipo_atendimento: "domicilio" },
        "visita"
      )
    ).toBe("aprovada");
  });

  it("serviço concluído com aprovação vai para concluida", () => {
    expect(
      statusPosCheckout(
        { status: "em_execucao", aprovado: true, tipo_atendimento: "domicilio" },
        "servico_concluido"
      )
    ).toBe("concluida");
  });

  it("ignora oficina", () => {
    expect(
      statusPosCheckout(
        { status: "em_execucao", aprovado: true, tipo_atendimento: "oficina" },
        "servico_concluido"
      )
    ).toBeNull();
  });
});

describe("statusPermiteCheckin", () => {
  it("bloqueia aguardando_aprovacao", () => {
    expect(statusPermiteCheckin("aguardando_aprovacao")).toBe(false);
  });

  it("permite aprovada para retorno", () => {
    expect(statusPermiteCheckin("aprovada")).toBe(true);
  });
});

describe("validarTransicaoStatus", () => {
  it("técnico pode ir de em_roteiro para em_execucao", () => {
    expect(() => validarTransicaoStatus("em_roteiro", "em_execucao", "tecnico")).not.toThrow();
  });

  it("técnico não pode cancelar OS", () => {
    expect(() => validarTransicaoStatus("em_execucao", "cancelada", "tecnico")).toThrow();
  });

  it("sistema pode check-out para aguardando_aprovacao", () => {
    expect(() =>
      validarTransicaoStatus("em_execucao", "aguardando_aprovacao", "tecnico", { sistema: true })
    ).not.toThrow();
  });
});

describe("statusAposAprovacao", () => {
  it("mantém em_execucao durante visita ativa", () => {
    expect(statusAposAprovacao("em_execucao")).toBe("em_execucao");
  });

  it("aguardando_aprovacao vira aprovada", () => {
    expect(statusAposAprovacao("aguardando_aprovacao")).toBe("aprovada");
  });
});

describe("calcValorTotalCliente", () => {
  it("soma visita quando não abate", () => {
    expect(calcValorTotalCliente(200, 80, false, 0, 0)).toBe(280);
  });

  it("abate visita já paga", () => {
    expect(calcValorTotalCliente(200, 80, true, 0, 0)).toBe(120);
  });
});

describe("calcValorAprovadoOs", () => {
  it("usa mesma regra do total do cliente", () => {
    expect(
      calcValorAprovadoOs({
        valor_itens: 200,
        valor_visita: 80,
        abater_visita: true,
        desconto: 10,
        acrescimo: 0,
      })
    ).toBe(110);
  });
});

describe("comissão e produtividade", () => {
  it("calcula comissão sobre lucro", () => {
    expect(calcComissaoTecnico(1000, 10)).toBe(100);
    expect(calcComissaoTecnico(1000, 0)).toBe(0);
  });

  it("agrupa lucro por técnico", () => {
    const rows = agruparLucroPorTecnico(
      [
        {
          id: "1",
          tecnico: "João",
          tecnico_id: "t1",
          valor_total: 500,
          custo_total: 200,
        },
        {
          id: "2",
          tecnico: "João",
          tecnico_id: "t1",
          valor_total: 300,
          custo_total: 100,
        },
      ],
      15
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].osConcluidas).toBe(2);
    expect(rows[0].lucro).toBe(500);
    expect(rows[0].comissao).toBe(75);
  });

  it("lucro simples arredondado", () => {
    expect(calcLucroOsSimples(100, 150)).toBe(-50);
  });
});

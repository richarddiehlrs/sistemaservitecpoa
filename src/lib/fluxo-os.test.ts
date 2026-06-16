import { describe, expect, it } from "vitest";
import { statusAposAprovacao, calcValorAprovadoOs } from "@/lib/aprovacao-os";
import { calcValorTotalCliente, resumoOrcamentoCliente } from "@/lib/os-valores";
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

  it("sistema permite reaprovacao de em_roteiro", () => {
    expect(() =>
      validarTransicaoStatus("em_roteiro", "aguardando_aprovacao", "atendente", { sistema: true })
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

describe("resumoOrcamentoCliente", () => {
  it("mostra abatimento e label de resta pagar", () => {
    const r = resumoOrcamentoCliente({
      valor_itens: 500,
      valor_visita: 80,
      abater_visita: true,
    });
    expect(r.total).toBe(420);
    expect(r.mostraAbatimentoVisita).toBe(true);
    expect(r.labelTotal).toBe("Total do reparo (resta pagar)");
    expect(r.visitaLinha.prefixo).toBe("- ");
    expect(r.textoVisitaPaga).toContain("já foi paga");
  });

  it("sem abatimento mantém total simples", () => {
    const r = resumoOrcamentoCliente({
      valor_itens: 200,
      valor_visita: 80,
      abater_visita: false,
    });
    expect(r.total).toBe(280);
    expect(r.mostraAbatimentoVisita).toBe(false);
    expect(r.labelTotal).toBe("Total");
    expect(r.textoVisitaPaga).toBeNull();
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

describe("checkin e aprovação", () => {
  it("bloqueia check-in após orçamento enviado sem aprovação", async () => {
    const { checkinBloqueadoPorAprovacao } = await import("@/lib/checkin-os");
    expect(
      checkinBloqueadoPorAprovacao(
        { status: "em_roteiro", aprovado: false },
        ["aberta", "aguardando_aprovacao"]
      )
    ).toBe(true);
  });

  it("permite check-in na primeira visita em roteiro", async () => {
    const { checkinBloqueadoPorAprovacao } = await import("@/lib/checkin-os");
    expect(
      checkinBloqueadoPorAprovacao({ status: "em_roteiro", aprovado: false }, ["aberta"])
    ).toBe(false);
  });

  it("permite check-in após aprovação", async () => {
    const { checkinBloqueadoPorAprovacao } = await import("@/lib/checkin-os");
    expect(
      checkinBloqueadoPorAprovacao(
        { status: "em_roteiro", aprovado: true },
        ["aguardando_aprovacao", "aprovada"]
      )
    ).toBe(false);
  });
});

describe("portal aprovação", () => {
  it("só permite aprovar em status corretos", async () => {
    const { podeAprovarOrcamentoPortal } = await import("@/lib/portal-aprovacao");
    expect(
      podeAprovarOrcamentoPortal({
        aprovado: false,
        status: "aguardando_aprovacao",
        valorTotal: 200,
      })
    ).toBe(true);
    expect(
      podeAprovarOrcamentoPortal({
        aprovado: false,
        status: "em_execucao",
        valorTotal: 200,
      })
    ).toBe(false);
  });
});

describe("orcamento e visita", () => {
  it("abate visita por padrão quando há itens no orçamento", async () => {
    const { resolverAbaterVisita } = await import("@/lib/orcamento-os");
    const fd = new FormData();
    expect(resolverAbaterVisita("domicilio", fd, 200)).toBe(true);
  });

  it("soma visita só quando incluir_visita_orcamento marcado", async () => {
    const { resolverAbaterVisita } = await import("@/lib/orcamento-os");
    const fd = new FormData();
    fd.set("incluir_visita_orcamento", "on");
    expect(resolverAbaterVisita("domicilio", fd, 200)).toBe(false);
  });

  it("envia para aguardando_aprovacao quando há orçamento em roteiro", async () => {
    const { deveEnviarAguardandoAprovacao } = await import("@/lib/orcamento-os");
    expect(
      deveEnviarAguardandoAprovacao({
        tipo: "domicilio",
        aprovado: false,
        status: "em_roteiro",
        valorItens: 150,
        total: 70,
      })
    ).toBe(true);
  });
});

describe("mensagens WhatsApp cliente", () => {
  it("inclui link do portal no orçamento pronto", async () => {
    const { mensagemWhatsAppCliente } = await import("@/lib/mensagens-cliente");
    const msg = mensagemWhatsAppCliente("orcamento_pronto", {
      empresa: "Servitec",
      cliente: "Maria",
      numero: 7,
      portalUrl: "https://exemplo.com/os/abc",
      valorTotal: 350,
    });
    expect(msg).toContain("Maria");
    expect(msg).toContain("https://exemplo.com/os/abc");
  });
});

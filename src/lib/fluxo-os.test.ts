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
  transicoesPermitidas,
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

  it("precisa de peça sem aprovação vai para aguardando_aprovacao", () => {
    expect(
      statusPosCheckout(
        { status: "em_execucao", aprovado: false, tipo_atendimento: "domicilio" },
        "aguardando_peca"
      )
    ).toBe("aguardando_aprovacao");
  });

  it("precisa de peça com orçamento aprovado vai para aguardando_peca", () => {
    expect(
      statusPosCheckout(
        { status: "em_execucao", aprovado: true, tipo_atendimento: "domicilio" },
        "aguardando_peca"
      )
    ).toBe("aguardando_peca");
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

  it("sistema permite check-in de aguardando_aprovacao na 1ª visita", () => {
    expect(() =>
      validarTransicaoStatus("aguardando_aprovacao", "em_execucao", "tecnico", { sistema: true })
    ).not.toThrow();
  });

  it("sistema permite marcar OS original em garantia ao abrir retorno", () => {
    expect(() =>
      validarTransicaoStatus("concluida", "garantia", "admin", { sistema: true })
    ).not.toThrow();
    expect(() =>
      validarTransicaoStatus("entregue", "garantia", "admin", { sistema: true })
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

describe("calcReceitaFaturamentoOs", () => {
  it("visita abatida: faturamento = subtotal, saldo menor", async () => {
    const { calcReceitaFaturamentoOs, calcValorTotalCliente } = await import("@/lib/os-valores");
    expect(calcReceitaFaturamentoOs(600, 100, true, 0, 0)).toBe(600);
    expect(calcValorTotalCliente(600, 100, true, 0, 0)).toBe(500);
  });

  it("visita no total quando não abate", async () => {
    const { calcReceitaFaturamentoOs } = await import("@/lib/os-valores");
    expect(calcReceitaFaturamentoOs(600, 100, false, 0, 0)).toBe(700);
  });
});

describe("saldoEmAberto com visita abatida", () => {
  it("a receber = faturamento − visita paga", async () => {
    const { saldoEmAberto } = await import("@/lib/financeiro");
    expect(saldoEmAberto({ valor: 600, valor_pago: 100, juros: 0, multa: 0 })).toBe(500);
  });
});

describe("resumoFinanceiroOs", () => {
  it("separa faturamento e saldo com visita abatida", async () => {
    const { resumoFinanceiroOs } = await import("@/lib/os-valores");
    const r = resumoFinanceiroOs({
      valor_itens: 600,
      valor_visita: 100,
      abater_visita: true,
      desconto: 0,
      acrescimo: 0,
    });
    expect(r.faturamento).toBe(600);
    expect(r.saldoCliente).toBe(500);
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

describe("transições técnico", () => {
  it("não permite concluir ou cliente ausente pelo dropdown", () => {
    expect(transicoesPermitidas("em_execucao", "tecnico")).not.toContain("concluida");
    expect(transicoesPermitidas("em_execucao", "tecnico")).not.toContain("cliente_ausente");
  });
});

describe("os-acesso", () => {
  it("valida atribuição por tecnico_id", async () => {
    const { osAtribuidaAoProfile } = await import("@/lib/os-acesso");
    const profile = { id: "t1", papel: "tecnico" as const, nome: "João", email: null };
    expect(osAtribuidaAoProfile(profile, { tecnico_id: "t1", tecnico: null })).toBe(true);
    expect(osAtribuidaAoProfile(profile, { tecnico_id: "t2", tecnico: null })).toBe(false);
    expect(osAtribuidaAoProfile({ ...profile, papel: "admin" }, { tecnico_id: "t2", tecnico: null })).toBe(true);
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
  it("bloqueia check-in após orçamento enviado sem aprovação (retorno)", async () => {
    const { checkinBloqueadoPorAprovacao } = await import("@/lib/checkin-os");
    expect(
      checkinBloqueadoPorAprovacao(
        { status: "em_roteiro", aprovado: false },
        ["aberta", "aguardando_aprovacao"],
        1
      )
    ).toBe(true);
  });

  it("permite check-in na primeira visita em roteiro", async () => {
    const { checkinBloqueadoPorAprovacao } = await import("@/lib/checkin-os");
    expect(
      checkinBloqueadoPorAprovacao({ status: "em_roteiro", aprovado: false }, ["aberta"], 0)
    ).toBe(false);
  });

  it("permite 1ª visita mesmo com orçamento enviado antes da ida", async () => {
    const { validarCheckinOs } = await import("@/lib/checkin-os");
    expect(
      validarCheckinOs(
        { status: "aguardando_aprovacao", aprovado: false },
        ["aberta", "aguardando_aprovacao"],
        0
      ).ok
    ).toBe(true);
  });

  it("bloqueia retorno sem aprovação", async () => {
    const { validarCheckinOs } = await import("@/lib/checkin-os");
    expect(
      validarCheckinOs(
        { status: "aguardando_aprovacao", aprovado: false },
        ["aberta", "aguardando_aprovacao"],
        1
      ).ok
    ).toBe(false);
  });

  it("permite check-in após aprovação", async () => {
    const { checkinBloqueadoPorAprovacao } = await import("@/lib/checkin-os");
    expect(
      checkinBloqueadoPorAprovacao(
        { status: "em_roteiro", aprovado: true },
        ["aguardando_aprovacao", "aprovada"],
        1
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
  it("statusReceitaComPagamento reflete visita paga e saldo pendente", async () => {
    const { statusReceitaComPagamento } = await import("@/lib/os-financeiro");
    expect(statusReceitaComPagamento(80, 80)).toBe("pago");
    expect(statusReceitaComPagamento(280, 80)).toBe("parcial");
    expect(statusReceitaComPagamento(200, 0)).toBe("pendente");
  });

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

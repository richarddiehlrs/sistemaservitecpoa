import { describe, expect, it } from "vitest";
import {
  MODELO_STATUS_ANTIGO,
  mensagemResumoOs,
  mensagemStatusOs,
  mensagemWhatsAppCliente,
  primeiroNome,
  saudacao,
} from "./mensagens-cliente";
import { descricaoParaCliente, mensagemCobranca } from "./whatsapp";

const ctx = {
  empresa: "ServitecPoa Assistência Técnica",
  empresaTelefone: "(51) 99999-0000",
  cliente: "lucia helena kulisz",
  numero: 130,
  status: "aguardando_aprovacao",
  valorTotal: 1980,
  portalUrl: "https://servitec.app/os/abc",
  equipamento: "Lava-louças Brastemp",
  hora: 10,
};

describe("peças das mensagens", () => {
  it("primeiro nome com maiúscula correta", () => {
    expect(primeiroNome("lucia helena kulisz")).toBe("Lucia");
    expect(primeiroNome("DIOGO KIRSCH MACIEL")).toBe("Diogo");
    expect(primeiroNome("  ")).toBe("");
    expect(primeiroNome(null)).toBe("");
  });

  it("saudação pelo horário", () => {
    expect(saudacao("Ana", 9)).toBe("Bom dia, Ana!");
    expect(saudacao("Ana", 14)).toBe("Boa tarde, Ana!");
    expect(saudacao(null, 20)).toBe("Boa noite!");
  });
});

describe("mensagens de OS", () => {
  it("orçamento pronto: dados, link e assinatura — sem usar o modelo genérico", () => {
    const msg = mensagemWhatsAppCliente("orcamento_pronto", { ...ctx, msgTemplate: MODELO_STATUS_ANTIGO });
    expect(msg).toMatch(/^Bom dia, Lucia! Tudo bem\?/);
    expect(msg).toContain("*OS:* OS-00130");
    expect(msg).toContain("*Equipamento:* Lava-louças Brastemp");
    expect(msg.replace(/ /g, " ")).toContain("R$ 1.980,00");
    expect(msg).toContain("https://servitec.app/os/abc");
    expect(msg).toContain("Atenciosamente,\n*ServitecPoa Assistência Técnica*\n(51) 99999-0000");
    expect(msg).not.toContain("status \"");
    expect(msg).not.toMatch(/\n{3,}/);
  });

  it("todas as mensagens têm saudação e assinatura, sem linhas vazias sobrando", () => {
    for (const ev of [
      "orcamento_pronto",
      "orcamento_aprovado",
      "visita_agendada",
      "tecnico_caminho",
      "tecnico_atendimento",
      "aguardando_peca",
      "retorno_agendado",
      "servico_concluido",
      "pedir_avaliacao",
    ] as const) {
      const msg = mensagemWhatsAppCliente(ev, { ...ctx, cliente: null, portalUrl: null, equipamento: null });
      expect(msg, ev).toMatch(/^Bom dia! Tudo bem\?/);
      expect(msg, ev).toContain("Atenciosamente");
      expect(msg, ev).not.toMatch(/\n{3,}|undefined|null/);
    }
  });

  it("visita agendada mostra data e turno", () => {
    const msg = mensagemWhatsAppCliente("visita_agendada", { ...ctx, dataPrevisao: "2026-11-12", turno: "manha", tecnico: "Richard" });
    expect(msg).toContain("*Data:* 12/11/2026");
    expect(msg).toContain("*Técnico:* Richard");
  });

  it("status usa modelo personalizado só quando foi alterado", () => {
    expect(mensagemStatusOs({ ...ctx, msgTemplate: MODELO_STATUS_ANTIGO })).toContain("*Situação:* Aguardando aprovação");
    expect(mensagemStatusOs({ ...ctx, msgTemplate: "Oi {cliente}, OS {os}: {status}" })).toBe("Oi Lucia, OS OS-00130: Aguardando aprovação");
  });

  it("resumo da OS inclui garantia e defeito", () => {
    const msg = mensagemResumoOs({ ...ctx, garantiaDias: 90, defeito: "Não liga" });
    expect(msg).toContain("*Garantia:* 90 dias");
    expect(msg).toContain("*Defeito informado:* Não liga");
  });
});

describe("cobrança", () => {
  it("nome interno do lançamento vira texto para o cliente", () => {
    expect(descricaoParaCliente("Receita OS-00037")).toBe("Serviço da OS-00037");
    expect(descricaoParaCliente("Conserto do carro (2/5)")).toBe("Conserto do carro — parcela 2 de 5");
  });

  it("traz valor, vencimento e PIX copia e cola com o valor", () => {
    const msg = mensagemCobranca({
      cliente: "MARIA souza",
      descricao: "Receita OS-00037",
      valor: 740,
      vencimento: "2026-06-22",
      empresa: "ServitecPoa",
      hora: 15,
    });
    expect(msg).toMatch(/^Boa tarde, Maria!/);
    expect(msg).toContain("*Serviço da OS-00037*");
    expect(msg.replace(/ /g, " ")).toContain("R$ 740,00");
    expect(msg).toContain("22/06/2026");
    expect(msg).toContain("56.001.021/0001-86");
    expect(msg).toMatch(/000201.*5406740\.00/); // payload PIX com o valor
    expect(msg).toContain("desconsidere");
  });
});

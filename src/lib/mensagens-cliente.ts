import {
  formatCurrency,
  formatDate,
  formatHora,
  formatNumeroOS,
  STATUS_OS_LABEL,
} from "@/lib/format";
import { TURNO_LABEL } from "@/lib/turnos";
import { GOOGLE_REVIEW_URL } from "@/lib/pix";

export type EventoWhatsAppCliente =
  | "orcamento_pronto"
  | "orcamento_aprovado"
  | "visita_agendada"
  | "tecnico_caminho"
  | "tecnico_atendimento"
  | "aguardando_peca"
  | "retorno_agendado"
  | "servico_concluido"
  | "pedir_avaliacao";

export type ContextoMensagemCliente = {
  empresa: string;
  /** Telefone da empresa para a assinatura (opcional). */
  empresaTelefone?: string | null;
  cliente?: string | null;
  numero: number;
  status?: string;
  valorTotal?: number;
  portalUrl?: string | null;
  dataPrevisao?: string | null;
  turno?: string | null;
  horaInicio?: string | null;
  tecnico?: string | null;
  /** Ex.: "Geladeira Brastemp BRM44". */
  equipamento?: string | null;
  garantiaDias?: number | null;
  /** Modelo livre das Configurações (usado na mensagem de status genérica). */
  msgTemplate?: string | null;
  /** Para testes: hora do dia (0-23) usada na saudação. */
  hora?: number;
};

export const EVENTOS_WHATSAPP: Record<EventoWhatsAppCliente, { label: string; descricao: string }> = {
  orcamento_pronto: { label: "Orçamento pronto", descricao: "Envia valor e link para aprovação" },
  orcamento_aprovado: { label: "Orçamento aprovado", descricao: "Confirma a aprovação e próximos passos" },
  visita_agendada: { label: "Visita agendada", descricao: "Data, turno e técnico da visita" },
  tecnico_caminho: { label: "Técnico a caminho", descricao: "Avisa que o técnico saiu para o atendimento" },
  tecnico_atendimento: { label: "Em atendimento", descricao: "Técnico chegou ao local" },
  aguardando_peca: { label: "Aguardando peça", descricao: "Serviço pausado aguardando peça" },
  retorno_agendado: { label: "Retorno agendado", descricao: "Nova data para concluir o serviço" },
  servico_concluido: { label: "Serviço concluído", descricao: "Reparo finalizado, com garantia" },
  pedir_avaliacao: { label: "Pedir avaliação", descricao: "Agradece e pede avaliação no Google" },
};

const STATUS_PARA_EVENTOS: Partial<Record<string, EventoWhatsAppCliente[]>> = {
  aguardando_aprovacao: ["orcamento_pronto"],
  aprovada: ["orcamento_aprovado", "visita_agendada", "retorno_agendado"],
  em_roteiro: ["visita_agendada", "tecnico_caminho"],
  em_execucao: ["tecnico_caminho", "tecnico_atendimento"],
  aguardando_peca: ["aguardando_peca", "retorno_agendado"],
  concluida: ["servico_concluido", "pedir_avaliacao"],
  entregue: ["pedir_avaliacao"],
};

const STATUS_PARA_EVENTO_AUTO: Partial<Record<string, EventoWhatsAppCliente>> = {
  aguardando_aprovacao: "orcamento_pronto",
  em_roteiro: "visita_agendada",
  em_execucao: "tecnico_atendimento",
  aguardando_peca: "aguardando_peca",
  concluida: "servico_concluido",
  entregue: "pedir_avaliacao",
  aprovada: "orcamento_aprovado",
};

export function eventoAutoPorStatus(status: string): EventoWhatsAppCliente | null {
  return STATUS_PARA_EVENTO_AUTO[status] ?? null;
}

export function eventosSugeridosParaStatus(status: string): EventoWhatsAppCliente[] {
  return STATUS_PARA_EVENTOS[status] ?? ["visita_agendada"];
}

// ------------------------------------------------------------------
// Peças comuns a todas as mensagens
// ------------------------------------------------------------------

const MINUSCULAS = new Set(["da", "de", "do", "das", "dos", "e"]);

/** "lucia helena kulisz" → "Lucia"; "DIOGO KIRSCH" → "Diogo". */
export function primeiroNome(nome?: string | null): string {
  const p = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!p || MINUSCULAS.has(p.toLowerCase())) return "";
  return p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1).toLocaleLowerCase("pt-BR");
}

/** Hora atual em Porto Alegre (o navegador ou servidor podem estar em outro fuso). */
function horaLocal(): number {
  return Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())
  );
}

export function saudacao(nome?: string | null, hora: number = horaLocal()): string {
  const periodo = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const n = primeiroNome(nome);
  return n ? `${periodo}, ${n}!` : `${periodo}!`;
}

export function assinatura(empresa: string, telefone?: string | null): string {
  return `Atenciosamente,\n*${empresa}*` + (telefone?.trim() ? `\n${telefone.trim()}` : "");
}

/** Monta linhas "*Rótulo:* valor", ignorando as vazias. */
function dados(linhas: [string, string | null | undefined][]): string {
  return linhas
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `*${k}:* ${v}`)
    .join("\n");
}

function blocos(...partes: (string | null | undefined | false)[]): string {
  return partes.filter((p): p is string => typeof p === "string" && p.trim() !== "").join("\n\n");
}

function textoVisita(ctx: ContextoMensagemCliente): string | null {
  const partes: string[] = [];
  if (ctx.dataPrevisao) partes.push(formatDate(ctx.dataPrevisao));
  if (ctx.turno && TURNO_LABEL[ctx.turno]) partes.push(`turno da ${TURNO_LABEL[ctx.turno].toLowerCase()}`);
  else if (ctx.horaInicio) partes.push(`às ${formatHora(ctx.horaInicio)}`);
  return partes.length ? partes.join(", ") : null;
}

/** Substitui {empresa} {os} {status} {cliente} {total} num modelo livre. */
export function aplicarModelo(modelo: string, ctx: ContextoMensagemCliente): string {
  return modelo
    .replaceAll("{empresa}", ctx.empresa)
    .replaceAll("{os}", formatNumeroOS(ctx.numero))
    .replaceAll("{status}", STATUS_OS_LABEL[ctx.status || ""] || ctx.status || "")
    .replaceAll("{cliente}", primeiroNome(ctx.cliente))
    .replaceAll("{total}", ctx.valorTotal != null ? formatCurrency(ctx.valorTotal) : "");
}

/** Modelo antigo das Configurações — trocado pelo texto profissional padrão. */
export const MODELO_STATUS_ANTIGO = 'Olá! Aqui é da {empresa}. Sobre sua OS {os}: status "{status}".';

/** Atualização de status genérica (botão "Avisar status atual"). */
export function mensagemStatusOs(ctx: ContextoMensagemCliente): string {
  const modelo = ctx.msgTemplate?.trim();
  if (modelo && modelo !== MODELO_STATUS_ANTIGO) return aplicarModelo(modelo, ctx);
  return blocos(
    `${saudacao(ctx.cliente, ctx.hora)} Tudo bem?`,
    `Aqui é da *${ctx.empresa}*. Segue a atualização do seu atendimento:`,
    dados([
      ["OS", formatNumeroOS(ctx.numero)],
      ["Equipamento", ctx.equipamento],
      ["Situação", STATUS_OS_LABEL[ctx.status || ""] || ctx.status],
      ["Valor", ctx.valorTotal != null && ctx.valorTotal > 0 ? formatCurrency(ctx.valorTotal) : null],
    ]),
    ctx.portalUrl && `Acompanhe todos os detalhes pelo link:\n${ctx.portalUrl}`,
    "Qualquer dúvida, é só responder esta mensagem.",
    assinatura(ctx.empresa, ctx.empresaTelefone)
  );
}

/** Resumo completo da OS (botão "Enviar OS"). */
export function mensagemResumoOs(ctx: ContextoMensagemCliente & { defeito?: string | null }): string {
  return blocos(
    `${saudacao(ctx.cliente, ctx.hora)} Tudo bem?`,
    `Aqui é da *${ctx.empresa}*. Segue o resumo da sua ordem de serviço:`,
    dados([
      ["OS", formatNumeroOS(ctx.numero)],
      ["Equipamento", ctx.equipamento],
      ["Defeito informado", ctx.defeito],
      ["Situação", STATUS_OS_LABEL[ctx.status || ""] || ctx.status],
      ["Valor total", ctx.valorTotal != null ? formatCurrency(ctx.valorTotal) : null],
      ["Garantia", ctx.garantiaDias ? `${ctx.garantiaDias} dias` : null],
    ]),
    ctx.portalUrl && `Você pode ver, acompanhar e baixar a OS em PDF pelo link:\n${ctx.portalUrl}`,
    assinatura(ctx.empresa, ctx.empresaTelefone)
  );
}

export function mensagemWhatsAppCliente(evento: EventoWhatsAppCliente, ctx: ContextoMensagemCliente): string {
  const os = formatNumeroOS(ctx.numero);
  const ola = `${saudacao(ctx.cliente, ctx.hora)} Tudo bem?`;
  const eu = `Aqui é da *${ctx.empresa}*.`;
  const visita = textoVisita(ctx);
  const assina = assinatura(ctx.empresa, ctx.empresaTelefone);
  const valor = ctx.valorTotal != null && ctx.valorTotal > 0 ? formatCurrency(ctx.valorTotal) : null;

  switch (evento) {
    case "orcamento_pronto":
      return blocos(
        ola,
        `${eu} O orçamento do seu atendimento está pronto:`,
        dados([
          ["OS", os],
          ["Equipamento", ctx.equipamento],
          ["Valor", valor],
        ]),
        ctx.portalUrl
          ? `Para ver os detalhes e *aprovar*, acesse:\n${ctx.portalUrl}`
          : "Para aprovar, basta responder esta mensagem.",
        "Ficamos à disposição para esclarecer qualquer dúvida.",
        assina
      );

    case "orcamento_aprovado":
      return blocos(
        ola,
        `${eu} Recebemos a *aprovação do orçamento* da OS ${os}. Obrigado pela confiança!`,
        "Em breve entraremos em contato para confirmar a data de execução do serviço.",
        ctx.portalUrl && `Acompanhe pelo link:\n${ctx.portalUrl}`,
        assina
      );

    case "visita_agendada":
      return blocos(
        ola,
        `${eu} Sua visita técnica está *agendada*:`,
        dados([
          ["OS", os],
          ["Data", visita],
          ["Técnico", ctx.tecnico],
          ["Equipamento", ctx.equipamento],
        ]),
        "Pedimos que haja um responsável maior de idade no local e que o equipamento esteja acessível.",
        "Precisa remarcar? É só responder esta mensagem.",
        assina
      );

    case "tecnico_caminho":
      return blocos(
        ola,
        `${eu} ${ctx.tecnico ? `O técnico *${ctx.tecnico}*` : "Nosso técnico"} está *a caminho* para o atendimento da OS ${os}` +
          (visita ? ` (${visita})` : "") +
          ".",
        "Se houver algum imprevisto, por favor nos avise por aqui.",
        assina
      );

    case "tecnico_atendimento":
      return blocos(
        ola,
        `${eu} ${ctx.tecnico ? `O técnico *${ctx.tecnico}*` : "Nosso técnico"} chegou e *iniciou o atendimento* da OS ${os}.`,
        "Assim que concluir o diagnóstico, passaremos todas as informações.",
        assina
      );

    case "aguardando_peca":
      return blocos(
        ola,
        `${eu} Para concluir o serviço da OS ${os}` +
          (ctx.equipamento ? ` (${ctx.equipamento})` : "") +
          " precisamos de uma *peça*, que já está sendo providenciada.",
        "Assim que ela chegar, entraremos em contato para agendar o retorno.",
        ctx.portalUrl && `Acompanhe pelo link:\n${ctx.portalUrl}`,
        assina
      );

    case "retorno_agendado":
      return blocos(
        ola,
        `${eu} O *retorno* para concluir o serviço está agendado:`,
        dados([
          ["OS", os],
          ["Data", visita],
          ["Técnico", ctx.tecnico],
        ]),
        "Precisa remarcar? É só responder esta mensagem.",
        assina
      );

    case "servico_concluido":
      return blocos(
        ola,
        `${eu} O serviço da OS ${os}` + (ctx.equipamento ? ` (${ctx.equipamento})` : "") + " foi *concluído*.",
        ctx.garantiaDias ? `O serviço tem *garantia de ${ctx.garantiaDias} dias*. Qualquer problema, fale conosco.` : null,
        ctx.portalUrl && `Sua OS em PDF e o comprovante ficam disponíveis no link:\n${ctx.portalUrl}`,
        "Obrigado pela confiança!",
        assina
      );

    case "pedir_avaliacao":
      return blocos(
        ola,
        `${eu} Obrigado por confiar no nosso trabalho no atendimento da OS ${os}.`,
        `Sua opinião é muito importante para nós. Se puder, deixe sua avaliação no Google — leva menos de um minuto:\n${GOOGLE_REVIEW_URL}`,
        assina
      );

    default:
      return mensagemStatusOs(ctx);
  }
}

// ------------------------------------------------------------------
// Etapas da OS (linha do tempo) — mensagem ao registrar cada marco
// ------------------------------------------------------------------

export type EtapaMensagem =
  | "coletado_oficina"
  | "recebido_oficina"
  | "diagnostico"
  | "peca_solicitada"
  | "peca_recebida"
  | "reparo_iniciado"
  | "testes"
  | "pronto"
  | "saiu_entrega"
  | "entregue";

export function mensagemEtapa(
  etapa: EtapaMensagem,
  ctx: ContextoMensagemCliente & { previsao?: string | null; observacao?: string | null }
): string {
  const os = formatNumeroOS(ctx.numero);
  const ola = `${saudacao(ctx.cliente, ctx.hora)} Tudo bem?`;
  const eu = `Aqui é da *${ctx.empresa}*.`;
  const aparelho = ctx.equipamento ? `seu aparelho (${ctx.equipamento})` : "seu aparelho";
  const prev = ctx.previsao ? formatDate(ctx.previsao) : null;
  const obs = ctx.observacao?.trim() ? `_${ctx.observacao.trim()}_` : null;
  const link = ctx.portalUrl ? `Acompanhe cada etapa pelo link:\n${ctx.portalUrl}` : null;
  const assina = assinatura(ctx.empresa, ctx.empresaTelefone);
  const valor = ctx.valorTotal != null && ctx.valorTotal > 0 ? formatCurrency(ctx.valorTotal) : null;

  switch (etapa) {
    case "coletado_oficina":
      return blocos(ola, `${eu} Retiramos ${aparelho} referente à OS ${os} e ele já está a caminho da nossa oficina.`, "Assim que concluirmos o diagnóstico, enviaremos o orçamento para sua aprovação.", obs, link, assina);
    case "recebido_oficina":
      return blocos(ola, `${eu} ${aparelho.charAt(0).toUpperCase() + aparelho.slice(1)} chegou à nossa oficina (OS ${os}) e já entrou na fila de diagnóstico.`, obs, link, assina);
    case "diagnostico":
      return blocos(
        ola,
        `${eu} Concluímos o diagnóstico da OS ${os}.`,
        obs,
        valor ? `*Valor do orçamento:* ${valor}` : null,
        ctx.portalUrl ? `Veja os detalhes e *aprove* pelo link:\n${ctx.portalUrl}` : "Para aprovar, basta responder esta mensagem.",
        assina
      );
    case "peca_solicitada":
      return blocos(
        ola,
        `${eu} Para o reparo da OS ${os}, *solicitamos a peça* ao fornecedor.`,
        prev ? `*Previsão de chegada:* ${prev}` : null,
        "Assim que ela chegar, avisamos e seguimos com o serviço.",
        obs,
        link,
        assina
      );
    case "peca_recebida":
      return blocos(ola, `${eu} A *peça chegou*! Vamos dar sequência ao reparo da OS ${os}.`, obs, link, assina);
    case "reparo_iniciado":
      return blocos(ola, `${eu} *Iniciamos o reparo* de ${aparelho} (OS ${os}).`, "Avisaremos assim que estiver pronto.", obs, link, assina);
    case "testes":
      return blocos(ola, `${eu} O reparo da OS ${os} foi feito e ${aparelho} está *em testes de funcionamento*, para garantir que tudo está perfeito.`, obs, assina);
    case "pronto":
      return blocos(
        ola,
        `${eu} Boa notícia: ${aparelho} está *pronto*! (OS ${os})`,
        valor ? `*Valor do serviço:* ${valor}` : null,
        ctx.garantiaDias ? `O serviço tem *garantia de ${ctx.garantiaDias} dias*.` : null,
        "Vamos combinar a entrega ou a retirada? É só responder esta mensagem.",
        link,
        assina
      );
    case "saiu_entrega":
      return blocos(
        ola,
        `${eu} ${aparelho.charAt(0).toUpperCase() + aparelho.slice(1)} *saiu para entrega* (OS ${os}).`,
        prev ? `*Previsão:* ${prev}` : null,
        "Pedimos que haja alguém no local para receber.",
        obs,
        assina
      );
    case "entregue":
      return blocos(
        ola,
        `${eu} Confirmamos a *entrega* de ${aparelho} (OS ${os}). Obrigado pela confiança!`,
        ctx.garantiaDias ? `Lembrando: o serviço tem *garantia de ${ctx.garantiaDias} dias*. Qualquer problema, fale conosco.` : null,
        `Se puder, avalie nosso atendimento no Google:\n${GOOGLE_REVIEW_URL}`,
        assina
      );
  }
}

/** Aviso de visita reagendada (motivo em linguagem para o cliente). */
export function mensagemReagendamento(
  ctx: ContextoMensagemCliente & { textoMotivo: string; novaData: string; turnoNovo?: string | null }
): string {
  const quando = textoVisita({ ...ctx, dataPrevisao: ctx.novaData, turno: ctx.turnoNovo ?? null, horaInicio: null });
  return blocos(
    `${saudacao(ctx.cliente, ctx.hora)} Tudo bem?`,
    `Aqui é da *${ctx.empresa}*. ${ctx.textoMotivo}`,
    dados([
      ["OS", formatNumeroOS(ctx.numero)],
      ["Nova data", quando],
      ["Técnico", ctx.tecnico],
    ]),
    "Se esse horário não for bom para você, é só responder esta mensagem que ajustamos.",
    assinatura(ctx.empresa, ctx.empresaTelefone)
  );
}

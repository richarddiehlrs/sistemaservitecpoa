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
  cliente?: string | null;
  numero: number;
  status?: string;
  valorTotal?: number;
  portalUrl?: string | null;
  dataPrevisao?: string | null;
  turno?: string | null;
  horaInicio?: string | null;
  tecnico?: string | null;
  msgTemplate?: string | null;
};

export const EVENTOS_WHATSAPP: Record<
  EventoWhatsAppCliente,
  { label: string; descricao: string }
> = {
  orcamento_pronto: {
    label: "Orçamento pronto",
    descricao: "Cliente pode aprovar no portal",
  },
  orcamento_aprovado: {
    label: "Orçamento aprovado",
    descricao: "Confirmação de aprovação",
  },
  visita_agendada: {
    label: "Visita agendada",
    descricao: "Data e turno da visita",
  },
  tecnico_caminho: {
    label: "Técnico a caminho",
    descricao: "Ao iniciar deslocamento / check-in",
  },
  tecnico_atendimento: {
    label: "Em atendimento",
    descricao: "Técnico no local",
  },
  aguardando_peca: {
    label: "Aguardando peça",
    descricao: "Serviço pausado por peça",
  },
  retorno_agendado: {
    label: "Retorno agendado",
    descricao: "Nova data para executar o serviço",
  },
  servico_concluido: {
    label: "Serviço concluído",
    descricao: "Reparo finalizado",
  },
  pedir_avaliacao: {
    label: "Pedir avaliação",
    descricao: "NPS + Google após entrega",
  },
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

function formatarVisita(ctx: ContextoMensagemCliente): string {
  const partes: string[] = [];
  if (ctx.dataPrevisao) partes.push(formatDate(ctx.dataPrevisao));
  if (ctx.turno && TURNO_LABEL[ctx.turno]) {
    partes.push(TURNO_LABEL[ctx.turno]);
  } else if (ctx.horaInicio) {
    partes.push(formatHora(ctx.horaInicio));
  }
  return partes.join(" • ");
}

export function mensagemWhatsAppCliente(
  evento: EventoWhatsAppCliente,
  ctx: ContextoMensagemCliente
): string {
  const os = formatNumeroOS(ctx.numero);
  const cliente = ctx.cliente?.trim() || "";
  const empresa = ctx.empresa;
  const portal = ctx.portalUrl ? `\n\nAcompanhe pelo link:\n${ctx.portalUrl}` : "";
  const visita = formatarVisita(ctx);

  if (ctx.msgTemplate && evento === "orcamento_pronto") {
    return ctx.msgTemplate
      .replaceAll("{empresa}", empresa)
      .replaceAll("{os}", os)
      .replaceAll("{status}", STATUS_OS_LABEL[ctx.status || ""] || ctx.status || "")
      .replaceAll("{cliente}", cliente)
      .replaceAll("{total}", ctx.valorTotal != null ? formatCurrency(ctx.valorTotal) : "");
  }

  switch (evento) {
    case "orcamento_pronto":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! Aqui é da *${empresa}*.\n` +
        `Seu orçamento da OS *${os}* está pronto para aprovação.` +
        (ctx.valorTotal != null ? `\nTotal: *${formatCurrency(ctx.valorTotal)}*.` : "") +
        portal
      );
    case "orcamento_aprovado":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! Orçamento da OS *${os}* *aprovado*. ` +
        `Em breve agendamos ou confirmamos a execução do serviço.` +
        portal
      );
    case "visita_agendada":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! A *${empresa}* agendou a visita da OS *${os}*` +
        (visita ? ` para *${visita}*` : "") +
        (ctx.tecnico ? ` com o técnico ${ctx.tecnico}` : "") +
        `.` +
        portal
      );
    case "tecnico_caminho":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! O técnico da *${empresa}* está a caminho ` +
        `para atender sua OS *${os}*` +
        (visita ? ` (${visita})` : "") +
        `. Qualquer imprevisto, nos avise por aqui.`
      );
    case "tecnico_atendimento":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! O técnico da *${empresa}* chegou e iniciou o atendimento ` +
        `da OS *${os}*.`
      );
    case "aguardando_peca":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! Sobre a OS *${os}*: precisamos de uma peça para concluir o serviço. ` +
        `Assim que chegar, entraremos em contato para agendar o retorno.` +
        portal
      );
    case "retorno_agendado":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! Agendamos o *retorno* da OS *${os}*` +
        (visita ? ` para *${visita}*` : "") +
        (ctx.tecnico ? ` — técnico ${ctx.tecnico}` : "") +
        `.` +
        portal
      );
    case "servico_concluido":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! O serviço da OS *${os}* foi *concluído* pela *${empresa}*. ` +
        `Obrigado pela confiança!` +
        portal
      );
    case "pedir_avaliacao":
      return (
        `Olá${cliente ? ` ${cliente}` : ""}! Esperamos que tenha gostado do atendimento da OS *${os}*. ` +
        `Pode nos avaliar no Google? Sua opinião é muito importante:\n${GOOGLE_REVIEW_URL}` +
        (portal ? `\n\nPortal: ${ctx.portalUrl}` : "")
      );
    default:
      return `Olá! Aqui é da ${empresa}. Sobre sua OS ${os}.`;
  }
}

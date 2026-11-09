export type MotivoReagendamento = "tecnico_imprevisto" | "cliente_pediu" | "cliente_ausente" | "falta_peca" | "outro";

export const MOTIVOS_REAGENDAMENTO: Record<MotivoReagendamento, { label: string; cliente: string }> = {
  tecnico_imprevisto: {
    label: "Técnico não conseguiu ir",
    cliente: "Por um imprevisto da nossa equipe, precisamos remarcar a sua visita. Pedimos desculpas pelo transtorno.",
  },
  cliente_pediu: {
    label: "Cliente pediu para remarcar",
    cliente: "Conforme combinado, remarcamos a sua visita.",
  },
  cliente_ausente: {
    label: "Cliente não estava no local",
    cliente: "Estivemos no local, mas não conseguimos realizar o atendimento. Remarcamos a sua visita.",
  },
  falta_peca: {
    label: "Aguardando peça / material",
    cliente: "Para concluir o serviço precisamos de uma peça, por isso remarcamos a visita.",
  },
  outro: { label: "Outro motivo", cliente: "Precisamos remarcar a sua visita." },
};

export function motivoValido(v: string): v is MotivoReagendamento {
  return v in MOTIVOS_REAGENDAMENTO;
}

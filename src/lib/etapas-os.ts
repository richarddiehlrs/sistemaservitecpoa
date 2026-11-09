import type { StatusOS } from "@/types/database";

/** Marcos do atendimento (linha do tempo), além do status macro da OS. */
export type EtapaOs =
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

export type LocalEquipamento = "cliente" | "oficina" | "transito" | "entregue";

export const LOCAL_LABEL: Record<LocalEquipamento, string> = {
  cliente: "Com o cliente",
  oficina: "Na oficina",
  transito: "Em trânsito",
  entregue: "Devolvido ao cliente",
};

type DefEtapa = {
  label: string;
  /** Texto curto para o portal do cliente (linha do tempo). */
  cliente: string;
  /** Pede data prevista (ex.: chegada da peça). */
  pedePrevisao?: boolean;
};

export const ETAPAS: Record<EtapaOs, DefEtapa> = {
  coletado_oficina: { label: "Coletado para a oficina", cliente: "Aparelho retirado e a caminho da oficina" },
  recebido_oficina: { label: "Recebido na oficina", cliente: "Aparelho recebido na oficina" },
  diagnostico: { label: "Diagnóstico concluído", cliente: "Diagnóstico concluído — orçamento enviado" },
  peca_solicitada: { label: "Peça solicitada", cliente: "Peça solicitada ao fornecedor", pedePrevisao: true },
  peca_recebida: { label: "Peça recebida", cliente: "Peça recebida" },
  reparo_iniciado: { label: "Reparo iniciado", cliente: "Reparo em andamento" },
  testes: { label: "Em testes", cliente: "Reparo feito — em testes de funcionamento" },
  pronto: { label: "Pronto", cliente: "Serviço concluído — aparelho pronto" },
  saiu_entrega: { label: "Saiu para entrega", cliente: "Aparelho saiu para entrega", pedePrevisao: true },
  entregue: { label: "Entregue", cliente: "Aparelho entregue ao cliente" },
};

export const ORDEM_ETAPAS: EtapaOs[] = [
  "coletado_oficina",
  "recebido_oficina",
  "diagnostico",
  "peca_solicitada",
  "peca_recebida",
  "reparo_iniciado",
  "testes",
  "pronto",
  "saiu_entrega",
  "entregue",
];

export type ContextoEtapa = {
  status: StatusOS;
  aprovado: boolean;
  local: LocalEquipamento;
  tipoAtendimento: "domicilio" | "oficina" | string;
};

const FINALIZADA: StatusOS[] = ["cancelada", "entregue"];

/** Etapas que fazem sentido agora (em ordem). */
export function etapasDisponiveis(c: ContextoEtapa): EtapaOs[] {
  if (FINALIZADA.includes(c.status)) return [];
  const naOficina = c.local === "oficina";
  const concluida = c.status === "concluida";
  const r: EtapaOs[] = [];

  if (!concluida && c.local === "cliente") r.push("coletado_oficina");
  if (!concluida && (c.local === "transito" || (naOficina && c.tipoAtendimento !== "oficina"))) r.push("recebido_oficina");
  if (!concluida && !c.aprovado && ["aberta", "em_analise", "em_execucao", "cliente_ausente"].includes(c.status)) r.push("diagnostico");
  if (!concluida && c.status !== "aguardando_peca" && ["aprovada", "em_execucao", "em_analise", "aguardando_aprovacao"].includes(c.status)) {
    r.push("peca_solicitada");
  }
  if (c.status === "aguardando_peca") r.push("peca_recebida");
  if (!concluida && c.aprovado && ["aprovada", "aguardando_peca", "em_analise"].includes(c.status)) r.push("reparo_iniciado");
  if (c.status === "em_execucao") r.push("testes");
  if (!concluida && c.aprovado && ["aprovada", "em_execucao"].includes(c.status)) r.push("pronto");
  if (concluida && (c.local === "oficina" || c.local === "cliente")) r.push("saiu_entrega");
  if (concluida) r.push("entregue");

  return ORDEM_ETAPAS.filter((e) => r.includes(e));
}

/** Para onde a etapa leva a OS (status e local do aparelho). null = não muda. */
export function efeitoEtapa(
  etapa: EtapaOs,
  c: ContextoEtapa
): { status: StatusOS | null; local: LocalEquipamento | null } {
  switch (etapa) {
    case "coletado_oficina": {
      // Aguardando aprovação/peça: o aparelho muda de lugar, mas a etapa do negócio continua
      if (["aguardando_aprovacao", "aguardando_peca", "aprovada", "em_analise"].includes(c.status)) {
        return { status: null, local: "oficina" };
      }
      return { status: c.aprovado ? "aprovada" : "em_analise", local: "oficina" };
    }
    case "recebido_oficina":
      return { status: null, local: "oficina" };
    case "diagnostico":
      return { status: c.aprovado ? null : "aguardando_aprovacao", local: null };
    case "peca_solicitada":
      return { status: "aguardando_peca", local: null };
    case "peca_recebida":
      return { status: c.aprovado ? "aprovada" : "em_analise", local: null };
    case "reparo_iniciado":
      return { status: "em_execucao", local: null };
    case "testes":
      return { status: null, local: null };
    case "pronto":
      return { status: "concluida", local: null };
    case "saiu_entrega":
      return { status: null, local: "transito" };
    case "entregue":
      return { status: "entregue", local: "entregue" };
  }
}

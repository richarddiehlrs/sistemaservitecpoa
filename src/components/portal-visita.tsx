import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  Package,
  Wrench,
  UserX,
  XCircle,
} from "lucide-react";
import { formatDate, formatDateTime, formatHora, STATUS_OS_LABEL, STATUS_OS_COLOR } from "@/lib/format";
import { TURNO_LABEL } from "@/lib/turnos";
import { cn } from "@/lib/utils";

type HistoricoItem = {
  status: string;
  observacao?: string | null;
  created_at: string;
};

/** Etapas da jornada visíveis ao cliente (ordem fixa). */
const JORNADA = [
  { key: "registro", label: "Ordem registrada", icon: ClipboardList },
  { key: "orcamento", label: "Orçamento enviado", icon: FileText },
  { key: "aprovado", label: "Orçamento aprovado", icon: CheckCircle2 },
  { key: "roteiro", label: "Visita agendada", icon: Calendar },
  { key: "atendimento", label: "Em atendimento", icon: Wrench },
  { key: "peca", label: "Aguardando peça", icon: Package },
  { key: "concluido", label: "Serviço concluído", icon: CheckCircle2 },
] as const;

type EtapaKey = (typeof JORNADA)[number]["key"];

function statusNoHistorico(eventos: HistoricoItem[], ...statuses: string[]): boolean {
  return eventos.some((h) => statuses.includes(h.status));
}

/** Etapa atual com base no status real — não pula orçamento/aprovação indevidamente. */
function etapaAtualKey(status: string, aprovado: boolean): EtapaKey {
  if (status === "cancelada") return "registro";
  if (["concluida", "entregue", "garantia"].includes(status)) return "concluido";
  if (status === "aguardando_peca") return "peca";
  if (status === "em_execucao" || status === "cliente_ausente") return "atendimento";
  if (status === "em_roteiro") return "roteiro";
  if (status === "aprovada") return "aprovado";
  if (status === "aguardando_aprovacao") return "orcamento";
  return "registro";
}

/** Etapa concluída só quando há evidência no fluxo (histórico ou flag de aprovação). */
function etapaConcluida(
  key: EtapaKey,
  status: string,
  aprovado: boolean,
  eventos: HistoricoItem[]
): boolean {
  switch (key) {
    case "registro":
      return true;
    case "orcamento":
      return (
        statusNoHistorico(eventos, "aguardando_aprovacao") && status !== "aguardando_aprovacao"
      );
    case "aprovado":
      return aprovado;
    case "roteiro":
      return statusNoHistorico(
        eventos,
        "em_execucao",
        "cliente_ausente",
        "aguardando_aprovacao",
        "aguardando_peca",
        "concluida",
        "entregue"
      );
    case "atendimento":
      return statusNoHistorico(
        eventos,
        "aguardando_aprovacao",
        "aguardando_peca",
        "concluida",
        "entregue",
        "aprovada"
      );
    case "peca":
      return (
        statusNoHistorico(eventos, "concluida", "entregue") &&
        statusNoHistorico(eventos, "aguardando_peca")
      );
    case "concluido":
      return ["concluida", "entregue", "garantia"].includes(status);
    default:
      return false;
  }
}

function observacaoParaCliente(obs?: string | null): string | null {
  if (!obs?.trim()) return null;
  const o = obs.toLowerCase();
  if (o.includes("check-in") || o.includes("checkin")) return "Técnico iniciou o atendimento no local.";
  if (o.includes("check-out") || o.includes("checkout")) return "Visita finalizada pelo técnico.";
  if (o.includes("portal") || o.includes("aprovado pelo cliente")) return "Você aprovou o orçamento.";
  if (o.includes("via erp") || o.includes("atualizado via")) return null;
  if (o.includes("ordem de serviço aberta") || o.includes("ordem de servico aberta")) {
    return "Sua ordem foi registrada em nosso sistema.";
  }
  return obs;
}

function iconeHistorico(status: string) {
  switch (status) {
    case "aguardando_aprovacao":
      return FileText;
    case "aprovada":
      return CheckCircle2;
    case "em_roteiro":
      return Calendar;
    case "em_execucao":
      return Wrench;
    case "aguardando_peca":
      return Package;
    case "cliente_ausente":
      return UserX;
    case "concluida":
    case "entregue":
      return CheckCircle2;
    case "cancelada":
      return XCircle;
    default:
      return ClipboardList;
  }
}

function rotuloHistorico(status: string, obs?: string | null): string {
  if (status === "aberta" && obs?.toLowerCase().includes("ordem de servi")) {
    return "Ordem registrada";
  }
  return STATUS_OS_LABEL[status] || status;
}

export function PortalAcompanhamento({
  status,
  aprovado = false,
  dataAprovacao,
  dataPrevisao,
  turno,
  tecnico,
  historico = [],
  proximoAgendamento,
}: {
  status: string;
  aprovado?: boolean;
  dataAprovacao?: string | null;
  dataPrevisao?: string | null;
  turno?: string | null;
  tecnico?: string | null;
  historico?: HistoricoItem[];
  proximoAgendamento?: {
    data?: string;
    hora_inicio?: string | null;
    turno?: string | null;
  } | null;
}) {
  const cancelada = status === "cancelada";
  const atualKey = etapaAtualKey(status, aprovado);
  const ehAusente = status === "cliente_ausente";

  const eventos = [...historico].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const dataPorEtapa: Partial<Record<EtapaKey, string>> = {};
  for (const h of eventos) {
    if (h.status === "aberta" || h.status === "em_analise") {
      dataPorEtapa.registro = h.created_at;
    }
    if (h.status === "aguardando_aprovacao") dataPorEtapa.orcamento = h.created_at;
    if (h.status === "aprovada") dataPorEtapa.aprovado = h.created_at;
    if (h.status === "em_roteiro") dataPorEtapa.roteiro = h.created_at;
    if (h.status === "em_execucao" || h.status === "cliente_ausente") {
      dataPorEtapa.atendimento = h.created_at;
    }
    if (h.status === "aguardando_peca") dataPorEtapa.peca = h.created_at;
    if (h.status === "concluida" || h.status === "entregue") {
      dataPorEtapa.concluido = h.created_at;
    }
  }
  if (aprovado && dataAprovacao) dataPorEtapa.aprovado = dataAprovacao;

  const dataVisitaExibir = proximoAgendamento?.data || dataPrevisao;
  const turnoVisitaExibir = proximoAgendamento?.turno || turno;
  const horaVisitaExibir = proximoAgendamento?.hora_inicio || null;

  return (
    <div className="card mb-4 overflow-hidden p-5">
      <h2 className="mb-1 font-semibold text-slate-900">Acompanhamento do serviço</h2>
      <p className="mb-5 text-xs text-slate-500">
        Acompanhe cada etapa da sua ordem de serviço em tempo real.
      </p>

      {cancelada ? (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <XCircle className="h-5 w-5 shrink-0" />
          Esta ordem de serviço foi cancelada.
        </div>
      ) : (
        <ol className="mb-6 space-y-0">
          {JORNADA.map((etapa, i) => {
            const Icon = etapa.icon;
            const concluida =
              etapaConcluida(etapa.key, status, aprovado, eventos) && etapa.key !== atualKey;
            const atual = atualKey === etapa.key;
            const futura = !concluida && !atual;
            const tevePeca =
              status === "aguardando_peca" ||
              eventos.some((h) => h.status === "aguardando_peca");
            if (etapa.key === "peca" && !tevePeca && !concluida && !atual) return null;

            const dataEtapa = dataPorEtapa[etapa.key];

            return (
              <li key={etapa.key} className="relative flex gap-3 pb-5 last:pb-0">
                {i < JORNADA.length - 1 && (
                  <span
                    className={cn(
                      "absolute left-[15px] top-8 bottom-0 w-0.5",
                      concluida ? "bg-brand-400" : "bg-slate-200"
                    )}
                  />
                )}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                    concluida && "border-brand-500 bg-brand-500 text-white",
                    atual && !ehAusente && "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-100",
                    atual &&
                      ehAusente &&
                      etapa.key === "atendimento" &&
                      "border-rose-500 bg-rose-50 text-rose-700 ring-4 ring-rose-100",
                    futura && "border-slate-200 bg-white text-slate-300"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      concluida || atual ? "text-slate-900" : "text-slate-400"
                    )}
                  >
                    {etapa.label}
                    {atual && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
                        Agora
                      </span>
                    )}
                  </p>
                  {concluida && dataEtapa && etapa.key !== "roteiro" && (
                    <p className="text-xs text-slate-500">{formatDateTime(dataEtapa)}</p>
                  )}
                  {atual && ehAusente && etapa.key === "atendimento" && (
                    <p className="mt-1 text-xs text-rose-600">
                      Técnico compareceu, mas não foi possível realizar o atendimento.
                    </p>
                  )}
                  {(atual || concluida) && etapa.key === "roteiro" && dataVisitaExibir && (
                    <p className="mt-1 text-xs text-slate-600">
                      Visita prevista: {formatDate(dataVisitaExibir)}
                      {turnoVisitaExibir && TURNO_LABEL[turnoVisitaExibir]
                        ? ` • ${TURNO_LABEL[turnoVisitaExibir]}`
                        : ""}
                      {horaVisitaExibir ? ` • ${formatHora(horaVisitaExibir)}` : ""}
                    </p>
                  )}
                  {atual && etapa.key === "atendimento" && tecnico && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                      <MapPin className="h-3 w-3" /> Técnico: {tecnico}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {eventos.length > 0 && (
        <>
          <div className="mb-3 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Histórico detalhado
            </h3>
          </div>
          <ol className="space-y-3">
            {[...eventos].reverse().map((h, i) => {
              const Icon = iconeHistorico(h.status);
              const obs = observacaoParaCliente(h.observacao);
              const cor = STATUS_OS_COLOR[h.status] || "bg-slate-100 text-slate-600";
              return (
                <li
                  key={`${h.created_at}-${i}`}
                  className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5"
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      cor
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <p className="text-sm font-medium text-slate-800">
                        {rotuloHistorico(h.status, h.observacao)}
                      </p>
                      <time className="text-xs text-slate-400">{formatDateTime(h.created_at)}</time>
                    </div>
                    {obs && <p className="mt-0.5 text-xs text-slate-600">{obs}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

/** @deprecated Use PortalAcompanhamento — mantido para compatibilidade de import. */
export function PortalVisitaStatus(props: {
  status: string;
  dataPrevisao?: string | null;
  turno?: string | null;
  tecnico?: string | null;
}) {
  return (
    <PortalAcompanhamento
      status={props.status}
      dataPrevisao={props.dataPrevisao}
      turno={props.turno}
      tecnico={props.tecnico}
      historico={[]}
    />
  );
}

/** @deprecated Use PortalAcompanhamento */
export function PortalTimeline({ historico }: { historico: HistoricoItem[] }) {
  return <PortalAcompanhamento status="aberta" historico={historico} />;
}

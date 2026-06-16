import type { SupabaseClient } from "@supabase/supabase-js";
import { sincronizarAgendaStatusOs } from "@/lib/agenda-os";
import { criarReceitaPendenteOs, cancelarReceitaPendenteOs } from "@/lib/os-financeiro";
import { notificarOsAprovada, notificarReaprovacaoOrcamento } from "@/lib/notificacoes";
import { calcValorTotalCliente } from "@/lib/os-valores";
import {
  podeAprovarOrcamentoPortal,
  STATUS_PORTAL_PODE_APROVAR,
} from "@/lib/portal-aprovacao";
import type { Database, StatusOS } from "@/types/database";

type Db = SupabaseClient<Database>;

/** Status que passam para `aprovada` ao aprovar orçamento (execução mantém status atual). */
export const STATUS_APROVA_PARA: StatusOS[] = ["aberta", "em_analise", "aguardando_aprovacao"];

/** Status que voltam para aguardando_aprovacao quando o orçamento muda após aprovação. */
export const STATUS_REAPROVA_ORCAMENTO: StatusOS[] = [
  "aprovada",
  "em_execucao",
  "em_roteiro",
  "aguardando_peca",
];

export function statusAposAprovacao(statusAtual: StatusOS): StatusOS {
  if (statusAtual === "em_execucao" || statusAtual === "em_roteiro" || statusAtual === "aguardando_peca") {
    return statusAtual;
  }
  return STATUS_APROVA_PARA.includes(statusAtual) ? "aprovada" : statusAtual;
}

export type AprovarOsResult =
  | { ok: true; jaAprovada?: boolean }
  | { ok: false; erro: string };

export function calcValorAprovadoOs(os: {
  valor_itens: number;
  valor_visita: number;
  abater_visita: boolean;
  desconto: number;
  acrescimo: number;
}): number {
  return calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
}

/** Aprovação: OS + histórico + agenda + financeiro + notificações (com rollback se financeiro falhar). */
export async function executarAprovacaoOs(
  supabase: Db,
  opts: {
    osId: string;
    assinatura?: string | null;
    obs?: string | null;
    origem: string;
  }
): Promise<AprovarOsResult> {
  const { data: os } = await supabase
    .from("ordens_servico")
    .select(
      "id, numero, aprovado, status, tecnico_id, valor_itens, valor_visita, abater_visita, desconto, acrescimo, valor_total, clientes(nome)"
    )
    .eq("id", opts.osId)
    .maybeSingle();

  if (!os) return { ok: false, erro: "OS não encontrada." };
  if (os.status === "cancelada") return { ok: false, erro: "Esta ordem foi cancelada." };
  if (os.status === "cliente_ausente") {
    return { ok: false, erro: "Não é possível aprovar enquanto o cliente estiver ausente." };
  }

  const valorAprovado = calcValorAprovadoOs(os);

  if (opts.origem.includes("portal")) {
    if (
      !podeAprovarOrcamentoPortal({
        aprovado: Boolean(os.aprovado),
        status: os.status,
        valorTotal: valorAprovado,
      })
    ) {
      return {
        ok: false,
        erro: "Orçamento não disponível para aprovação neste momento.",
      };
    }
  } else if (
    !(STATUS_PORTAL_PODE_APROVAR as readonly string[]).includes(os.status) &&
    os.status !== "em_execucao" &&
    os.status !== "em_roteiro" &&
    os.status !== "aguardando_peca"
  ) {
    return {
      ok: false,
      erro: `Não é possível aprovar orçamento com status "${os.status}".`,
    };
  }

  // @ts-expect-error relação embutida
  const clienteNome = os.clientes?.nome as string | undefined;
  const statusOriginal = os.status as StatusOS;

  if (valorAprovado <= 0) {
    return { ok: false, erro: "Informe os valores (serviços/peças ou visita) antes de aprovar." };
  }

  if (os.aprovado) {
    await criarReceitaPendenteOs(supabase, os.id);
    return { ok: true, jaAprovada: true };
  }

  const novoStatus = statusAposAprovacao(statusOriginal);

  const update: Record<string, unknown> = {
    aprovado: true,
    data_aprovacao: new Date().toISOString(),
    observacao_aprovacao: opts.obs || null,
    status: novoStatus,
    valor_aprovado: valorAprovado,
    valor_total: valorAprovado,
  };
  if (opts.assinatura) update.assinatura_cliente = opts.assinatura;

  const { data: atualizada, error: updErr } = await supabase
    .from("ordens_servico")
    .update(update)
    .eq("id", os.id)
    .eq("aprovado", false)
    .select("id")
    .maybeSingle();

  if (updErr) {
    console.error("[aprovacao-os] Erro ao atualizar OS:", updErr.message);
    return { ok: false, erro: "Não foi possível aprovar. Tente novamente." };
  }

  if (!atualizada) {
    await criarReceitaPendenteOs(supabase, os.id);
    return { ok: true, jaAprovada: true };
  }

  await supabase.from("os_status_historico").insert({
    os_id: os.id,
    status: novoStatus,
    observacao: `Orçamento aprovado (${opts.origem})`,
  });

  await sincronizarAgendaStatusOs(supabase, os.id, novoStatus);

  const financeOk = await criarReceitaPendenteOs(supabase, os.id);
  if (!financeOk) {
    console.warn("[aprovacao-os] Receita não criada — revertendo aprovação OS", os.id);
    await supabase
      .from("ordens_servico")
      .update({
        aprovado: false,
        data_aprovacao: null,
        valor_aprovado: null,
        observacao_aprovacao: null,
        status: statusOriginal,
        valor_total: Number(os.valor_total),
        ...(opts.assinatura ? { assinatura_cliente: null } : {}),
      })
      .eq("id", os.id);

    await supabase.from("os_status_historico").insert({
      os_id: os.id,
      status: statusOriginal,
      observacao: "Aprovação revertida: não foi possível gerar receita no financeiro",
    });

    return { ok: false, erro: "Não foi possível gerar a receita no financeiro. A aprovação foi desfeita." };
  }

  await notificarOsAprovada({
    osId: os.id,
    numero: os.numero,
    clienteNome,
    tecnicoId: os.tecnico_id,
  });

  return { ok: true };
}

/** Zera aprovação quando o orçamento muda após aprovação. */
export async function requererReaprovacaoSeValoresMudaram(
  supabase: Db,
  osId: string,
  antes: {
    aprovado: boolean;
    valor_aprovado: number | null;
    status: StatusOS;
    valor_itens: number;
    valor_visita: number;
    abater_visita: boolean;
    desconto: number;
    acrescimo: number;
  },
  totalNovo: number
): Promise<boolean> {
  if (!antes.aprovado) return false;

  const referencia =
    antes.valor_aprovado != null
      ? Number(antes.valor_aprovado)
      : calcValorAprovadoOs(antes);

  if (Math.abs(totalNovo - referencia) < 0.01) return false;

  try {
    await cancelarReceitaPendenteOs(supabase, osId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Não foi possível alterar o orçamento.";
    throw new Error(msg);
  }

  await supabase
    .from("ordens_servico")
    .update({
      aprovado: false,
      valor_aprovado: null,
      data_aprovacao: null,
      observacao_aprovacao: null,
    })
    .eq("id", osId);

  if (STATUS_REAPROVA_ORCAMENTO.includes(antes.status)) {
    const { data: osMeta } = await supabase
      .from("ordens_servico")
      .select("numero, clientes(nome)")
      .eq("id", osId)
      .maybeSingle();

    const { transicionarStatusOs } = await import("@/lib/transicao-os");
    await transicionarStatusOs(supabase, {
      osId,
      status: "aguardando_aprovacao",
      observacao: "Orçamento alterado — nova aprovação do cliente necessária (receita pendente cancelada)",
      origem: "reaprovacao",
      sistema: true,
      skipFinanceiro: true,
    });

    if (osMeta) {
      // @ts-expect-error relação embutida
      const clienteNome = osMeta.clientes?.nome as string | undefined;
      await notificarReaprovacaoOrcamento({
        osId,
        numero: osMeta.numero,
        clienteNome,
      });
    }
  }

  return true;
}

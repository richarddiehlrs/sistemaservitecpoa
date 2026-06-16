import type { SupabaseClient } from "@supabase/supabase-js";
import type { Papel } from "@/lib/permissoes";
import { sincronizarAgendaStatusOs } from "@/lib/agenda-os";
import { cancelarLancamentosOs, criarReceitaPendenteOs } from "@/lib/os-financeiro";
import { notificarMudancaStatusOs, notificarWhatsAppClienteSugerido } from "@/lib/notificacoes";
import { eventoAutoPorStatus } from "@/lib/mensagens-cliente";
import { validarTransicaoStatus } from "@/lib/transicao-status";
import type { Database, StatusOS } from "@/types/database";

type Db = SupabaseClient<Database>;

const NOTIFICAR_STATUS: StatusOS[] = [
  "aguardando_aprovacao",
  "aguardando_peca",
  "aprovada",
  "em_roteiro",
  "em_execucao",
  "concluida",
  "entregue",
];

export type TransicaoOsOpts = {
  osId: string;
  status: StatusOS;
  observacao?: string | null;
  origem?: string;
  skipNotificacao?: boolean;
  skipFinanceiro?: boolean;
  /** Pula validação da matriz (check-in, check-out, portal interno). */
  sistema?: boolean;
  papel?: Papel;
  extras?: Record<string, unknown>;
};

/** Único ponto de mudança de status — histórico, agenda, financeiro e notificações. */
export async function transicionarStatusOs(supabase: Db, opts: TransicaoOsOpts) {
  const { data: osAntes } = await supabase
    .from("ordens_servico")
    .select("numero, status, tecnico_id, clientes(nome)")
    .eq("id", opts.osId)
    .single();

  if (!osAntes) throw new Error("OS não encontrada.");
  if (osAntes.status === opts.status) return { mudou: false as const };

  if (opts.papel) {
    validarTransicaoStatus(osAntes.status as StatusOS, opts.status, opts.papel, {
      sistema: opts.sistema,
    });
  } else if (opts.sistema) {
    validarTransicaoStatus(osAntes.status as StatusOS, opts.status, "admin", {
      sistema: true,
    });
  } else {
    throw new Error("Transição de status requer papel do operador ou flag sistema.");
  }

  const update: Record<string, unknown> = { status: opts.status, ...opts.extras };

  if (opts.status === "concluida") update.data_conclusao = new Date().toISOString();
  if (opts.status === "entregue") update.data_entrega = new Date().toISOString();

  const { error } = await supabase.from("ordens_servico").update(update).eq("id", opts.osId);
  if (error) throw new Error(error.message);

  const obsHistorico =
    opts.observacao ||
    (opts.origem ? `Atualizado via ${opts.origem}` : null);

  const { error: histErr } = await supabase.from("os_status_historico").insert({
    os_id: opts.osId,
    status: opts.status,
    observacao: obsHistorico,
  });
  if (histErr) throw new Error(histErr.message);

  await sincronizarAgendaStatusOs(supabase, opts.osId, opts.status);

  if (opts.status === "cancelada") {
    await cancelarLancamentosOs(supabase, opts.osId);
  }

  if (
    !opts.skipNotificacao &&
    NOTIFICAR_STATUS.includes(opts.status)
  ) {
    // @ts-expect-error relação embutida
    const clienteNome = osAntes.clientes?.nome as string | undefined;
    notificarMudancaStatusOs({
      osId: opts.osId,
      numero: osAntes.numero,
      status: opts.status,
      clienteNome,
      tecnicoId: osAntes.tecnico_id,
    }).catch(() => {});

    const evento = eventoAutoPorStatus(opts.status);
    if (evento) {
      notificarWhatsAppClienteSugerido({
        osId: opts.osId,
        numero: osAntes.numero,
        clienteNome,
        evento,
      }).catch(() => {});
    }
  }

  return { mudou: true as const, anterior: osAntes.status };
}

/** Registra observação no histórico sem mudar o status. */
export async function registrarHistoricoOs(
  supabase: Db,
  osId: string,
  statusAtual: StatusOS,
  observacao: string
) {
  await supabase.from("os_status_historico").insert({
    os_id: osId,
    status: statusAtual,
    observacao,
  });
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { sincronizarAgendaStatusOs } from "@/lib/agenda-os";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";
import { formatDate } from "@/lib/format";

type Db = SupabaseClient<Database>;

export type ModoEncerramento = "feita" | "nao_feita";

/**
 * Encerra OS antiga no corte do financeiro, sem gerar faturamento nem pagamento:
 *  - receita sem pagamento → cancelada;
 *  - receita com pagamento parcial → valor reduzido ao que já foi pago (fica quitada);
 *  - pagamentos e despesas (peças) não são apagados;
 *  - status: "entregue" (serviço feito) ou "cancelada" (não feito), com histórico.
 */
export async function encerrarOsNoCorte(
  supabase: Db,
  osId: string,
  modo: ModoEncerramento,
  dataCorte: string
): Promise<{ numero: number }> {
  const { data: os, error } = await supabase
    .from("ordens_servico")
    .select("id, numero, status")
    .eq("id", osId)
    .single();
  if (error || !os) throw new Error("OS não encontrada.");
  if (!(STATUS_OS_ABERTAS as readonly string[]).includes(os.status)) {
    throw new Error(`OS-${String(os.numero).padStart(5, "0")} já está finalizada.`);
  }

  const { data: receitas } = await supabase
    .from("lancamentos_financeiros")
    .select("id, valor, valor_pago, juros, multa, observacoes")
    .eq("os_id", osId)
    .eq("tipo", "receita")
    .neq("status", "cancelado");

  const nota = `Encerrada no corte do financeiro (${formatDate(dataCorte)})`;
  for (const r of receitas || []) {
    const pago = Number(r.valor_pago) || 0;
    const obs = `${r.observacoes ? `${r.observacoes}\n` : ""}${nota}`;
    const upd =
      pago <= 0
        ? { status: "cancelado" as const, observacoes: obs }
        : {
            valor: Math.max(0, Math.round((pago - Number(r.juros || 0) - Number(r.multa || 0)) * 100) / 100),
            observacoes: obs,
          };
    const { error: e } = await supabase.from("lancamentos_financeiros").update(upd).eq("id", r.id);
    if (e) throw new Error(e.message);
  }

  const novoStatus = modo === "feita" ? "entregue" : "cancelada";
  const { error: eOs } = await supabase
    .from("ordens_servico")
    .update({ status: novoStatus, encerrada_corte_em: new Date().toISOString() } as never)
    .eq("id", osId);
  if (eOs) throw new Error(eOs.message);

  await supabase.from("os_status_historico").insert({
    os_id: osId,
    status: novoStatus,
    observacao: modo === "feita" ? `${nota} — serviço já realizado` : `${nota} — serviço não realizado`,
  });

  await sincronizarAgendaStatusOs(supabase as never, osId, novoStatus);
  return { numero: os.numero };
}

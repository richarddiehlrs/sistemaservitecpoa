"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sincronizarAgendaStatusOs } from "@/lib/agenda-os";
import { notificarOsAprovada } from "@/lib/notificacoes";
import { criarReceitaPendenteOs } from "@/lib/os-financeiro";
import type { Database, StatusOS } from "@/types/database";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key);
}

const STATUS_APROVA_PARA: StatusOS[] = ["aberta", "em_analise", "aguardando_aprovacao"];

export type AprovarPortalResult =
  | { ok: true; jaAprovada?: boolean }
  | { ok: false; erro: string };

/**
 * Aprovação atômica no portal: OS + histórico + agenda + financeiro + notificações.
 * Substitui o fluxo RPC + notificarAprovacaoPortal em duas etapas.
 */
export async function aprovarOrcamentoPortal(
  token: string,
  assinatura: string | null,
  obs: string | null
): Promise<AprovarPortalResult> {
  const supabase = supabaseAdmin();
  if (!supabase) {
    return {
      ok: false,
      erro: "Serviço temporariamente indisponível. Entre em contato com a loja.",
    };
  }

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, aprovado, status, tecnico_id, clientes(nome)")
    .eq("aprovacao_token", token)
    .maybeSingle();

  if (!os) return { ok: false, erro: "OS não encontrada." };
  if (os.status === "cancelada") return { ok: false, erro: "Esta ordem foi cancelada." };
  if (os.status === "cliente_ausente") {
    return { ok: false, erro: "Não é possível aprovar enquanto o cliente estiver ausente." };
  }

  // @ts-expect-error relação embutida
  const clienteNome = os.clientes?.nome as string | undefined;

  if (os.aprovado) {
    await criarReceitaPendenteOs(supabase, os.id);
    return { ok: true, jaAprovada: true };
  }

  const novoStatus: StatusOS = STATUS_APROVA_PARA.includes(os.status as StatusOS)
    ? "aprovada"
    : (os.status as StatusOS);

  const update: Record<string, unknown> = {
    aprovado: true,
    data_aprovacao: new Date().toISOString(),
    observacao_aprovacao: obs,
    status: novoStatus,
  };
  if (assinatura) update.assinatura_cliente = assinatura;

  const { data: atualizada, error: updErr } = await supabase
    .from("ordens_servico")
    .update(update)
    .eq("id", os.id)
    .eq("aprovado", false)
    .select("id")
    .maybeSingle();

  if (updErr) {
    console.error("[aprovarOrcamentoPortal] Erro ao atualizar OS:", updErr.message);
    return { ok: false, erro: "Não foi possível aprovar. Tente novamente." };
  }

  if (!atualizada) {
    await criarReceitaPendenteOs(supabase, os.id);
    return { ok: true, jaAprovada: true };
  }

  await supabase.from("os_status_historico").insert({
    os_id: os.id,
    status: "aprovada",
    observacao: "Orçamento aprovado pelo cliente (portal)",
  });

  await sincronizarAgendaStatusOs(supabase, os.id, novoStatus);

  const financeOk = await criarReceitaPendenteOs(supabase, os.id);
  if (!financeOk) {
    console.warn("[aprovarOrcamentoPortal] Receita não criada para OS", os.id);
  }

  await notificarOsAprovada({
    osId: os.id,
    numero: os.numero,
    clienteNome,
    tecnicoId: os.tecnico_id,
  });

  return { ok: true };
}

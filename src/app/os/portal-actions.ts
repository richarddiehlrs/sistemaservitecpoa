"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { executarAprovacaoOs, type AprovarOsResult } from "@/lib/aprovacao-os";
import type { Database } from "@/types/database";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key);
}

export type AprovarPortalResult = AprovarOsResult;

/**
 * Aprovação atômica no portal: OS + histórico + agenda + financeiro + notificações.
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
    .select("id")
    .eq("aprovacao_token", token)
    .maybeSingle();

  if (!os) return { ok: false, erro: "OS não encontrada." };

  return executarAprovacaoOs(supabase, {
    osId: os.id,
    assinatura,
    obs,
    origem: "portal do cliente",
  });
}

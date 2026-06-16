"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { notificarOsAprovada } from "@/lib/notificacoes";
import type { AprovarOsResult } from "@/lib/aprovacao-os";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key);
}

export type AprovarPortalResult = AprovarOsResult;

export type NpsPortalResult = { ok: true } | { ok: false; erro: string };

type PortalAprovarRpc = {
  ok?: boolean;
  erro?: string;
  ja_aprovada?: boolean;
  os_id?: string;
  numero?: number;
  tecnico_id?: string | null;
  cliente_nome?: string | null;
};

export async function registrarNpsPortal(
  token: string,
  nota: number,
  comentario?: string | null
): Promise<NpsPortalResult> {
  const supabase = supabaseAdmin();
  if (!supabase) {
    return { ok: false, erro: "Serviço temporariamente indisponível." };
  }

  const { data, error } = await supabase.rpc("registrar_nps_portal", {
    p_token: token,
    p_nota: nota,
    p_comentario: comentario ?? null,
  });

  if (error) return { ok: false, erro: error.message };

  const res = data as { ok?: boolean; erro?: string } | null;
  if (!res?.ok) return { ok: false, erro: res?.erro || "Não foi possível registrar." };
  return { ok: true };
}

/**
 * Aprovação atômica no portal via RPC security definer (não depende de service role para ler a OS).
 */
export async function aprovarOrcamentoPortal(
  token: string,
  assinatura: string | null,
  obs: string | null
): Promise<AprovarPortalResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("portal_aprovar_orcamento", {
    p_token: token,
    p_assinatura: assinatura,
    p_obs: obs,
  });

  if (error) {
    return { ok: false, erro: error.message || "Não foi possível aprovar." };
  }

  const res = (data ?? {}) as PortalAprovarRpc;

  if (!res.ok) {
    return { ok: false, erro: res.erro || "Não foi possível aprovar." };
  }

  if (res.ja_aprovada) {
    return { ok: true, jaAprovada: true };
  }

  if (res.os_id && res.numero != null) {
    notificarOsAprovada({
      osId: res.os_id,
      numero: res.numero,
      clienteNome: res.cliente_nome ?? undefined,
      tecnicoId: res.tecnico_id,
    }).catch(() => {});
  }

  return { ok: true };
}

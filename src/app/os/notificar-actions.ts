"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { notificarOsAprovada } from "@/lib/notificacoes";
import type { Database } from "@/types/database";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key);
}

/** Chamado após o cliente aprovar no portal (RPC os_aprovar). */
export async function notificarAprovacaoPortal(token: string) {
  const supabase = supabaseAdmin();
  if (!supabase) return;

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("id, numero, aprovado, clientes(nome)")
    .eq("aprovacao_token", token)
    .maybeSingle();

  if (!os?.aprovado) return;

  // @ts-expect-error relação embutida
  const clienteNome = os.clientes?.nome as string | undefined;

  await notificarOsAprovada({
    osId: os.id,
    numero: os.numero,
    clienteNome,
  });
}

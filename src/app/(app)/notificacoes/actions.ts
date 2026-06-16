"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";

export async function marcarNotificacaoLida(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true, lida_em: agora })
    .eq("id", id)
    .eq("user_id", profile.id);

  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function marcarTodasNotificacoesLidas() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const agora = new Date().toISOString();

  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true, lida_em: agora })
    .eq("user_id", profile.id)
    .eq("lida", false);

  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export type AlertaDispensadoInput = {
  ref_tipo: string;
  ref_id?: string | null;
};

/** Marca eventos como lidos e oculta alertas operacionais do sino. */
export async function limparTodosAlertas(items: AlertaDispensadoInput[]) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const agora = new Date().toISOString();

  await supabase
    .from("notificacoes")
    .update({ lida: true, lida_em: agora })
    .eq("user_id", profile.id)
    .eq("lida", false);

  const { dispensarAlertasUsuario } = await import("@/lib/notificacoes");
  await dispensarAlertasUsuario(profile.id, items);

  revalidatePath("/", "layout");
}

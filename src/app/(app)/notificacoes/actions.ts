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

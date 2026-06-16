"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";
import {
  type AlertaDispensadoEntry,
  mesclarAlertasDispensados,
  parseAlertasDispensados,
} from "@/lib/alertas-dispensados";

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

/** Marca eventos como lidos e persiste alertas dispensados (preferências do usuário). */
export async function limparTodosAlertas(
  items: AlertaDispensadoInput[]
): Promise<AlertaDispensadoEntry[]> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const agora = new Date().toISOString();

  const { data: naoLidas } = await supabase
    .from("notificacoes")
    .select("id, tipo, ref_id, ref_tipo")
    .eq("user_id", profile.id)
    .eq("lida", false);

  const todosItens: AlertaDispensadoInput[] = [...items];
  for (const n of naoLidas || []) {
    if (n.tipo === "sistema") continue;
    todosItens.push({
      ref_tipo: (n.ref_tipo as string) || n.tipo,
      ref_id: n.ref_id,
    });
    if (n.ref_tipo && n.ref_tipo !== n.tipo && n.ref_id) {
      todosItens.push({ ref_tipo: n.tipo, ref_id: n.ref_id });
    }
  }

  const { error: updErr } = await supabase
    .from("notificacoes")
    .update({ lida: true, lida_em: agora })
    .eq("user_id", profile.id)
    .eq("lida", false);

  if (updErr) throw new Error(updErr.message);

  const novos: AlertaDispensadoEntry[] = todosItens.map((item) => ({
    ref_tipo: item.ref_tipo,
    ref_id: item.ref_id ?? null,
    dispensado_em: agora,
  }));

  const { data: prefs } = await supabase
    .from("preferencias_alertas")
    .select("alertas_dispensados")
    .eq("user_id", profile.id)
    .maybeSingle();

  const atuais = parseAlertasDispensados(
    (prefs as { alertas_dispensados?: unknown } | null)?.alertas_dispensados
  );
  const merged = mesclarAlertasDispensados(atuais, novos);

  const { error: prefErr } = await supabase
    .from("preferencias_alertas")
    .upsert(
      {
        user_id: profile.id,
        alertas_dispensados: merged,
      },
      { onConflict: "user_id" }
    );

  if (prefErr) {
    throw new Error(
      prefErr.message.includes("alertas_dispensados")
        ? "Execute a migration 0022_alertas_dispensados.sql no Supabase para habilitar limpar alertas."
        : prefErr.message
    );
  }

  const { dispensarAlertasUsuario } = await import("@/lib/notificacoes");
  await dispensarAlertasUsuario(profile.id, todosItens);

  revalidatePath("/", "layout");
  return merged;
}

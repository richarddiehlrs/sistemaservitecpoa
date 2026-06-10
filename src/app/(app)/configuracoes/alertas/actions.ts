"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";

export async function salvarPreferenciasAlertas(formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const payload = {
    user_id: profile.id,
    push_ativo: formData.get("push_ativo") === "on",
    os_nova: formData.get("os_nova") === "on",
    os_aprovada: formData.get("os_aprovada") === "on",
    cliente_ausente: formData.get("cliente_ausente") === "on",
    despesa_campo: formData.get("despesa_campo") === "on",
    financeiro: formData.get("financeiro") === "on",
    oficina_parada: formData.get("oficina_parada") === "on",
    meta_faturamento: formData.get("meta_faturamento") === "on",
    email_resumo: formData.get("email_resumo") === "on",
    dias_oficina_parada: Math.min(30, Math.max(1, Number(formData.get("dias_oficina_parada")) || 2)),
  };

  const { error } = await supabase.from("preferencias_alertas").upsert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/configuracoes/alertas");
}

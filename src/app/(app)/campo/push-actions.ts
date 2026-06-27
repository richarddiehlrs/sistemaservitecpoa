"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";
import { safeAction, type ActionResult } from "@/lib/action-result";

export async function registrarPushSubscription(
  formData: FormData
): Promise<ActionResult> {
  return safeAction(async () => {
    const profile = await requireProfile();
    if (!["tecnico", "admin", "atendente"].includes(profile.papel)) {
      throw new Error("Push não disponível para este perfil.");
    }

    const endpoint = String(formData.get("endpoint") || "").trim();
    const p256dh = String(formData.get("p256dh") || "").trim();
    const auth = String(formData.get("auth") || "").trim();
    if (!endpoint || !p256dh || !auth) {
      throw new Error("Dados de inscrição inválidos.");
    }

    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: profile.id,
        endpoint,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );

    if (error) throw new Error(error.message);
    revalidatePath("/campo");
  });
}

export async function removerPushSubscription(
  endpoint: string
): Promise<ActionResult> {
  return safeAction(async () => {
    const profile = await requireProfile();
    const supabase = await createClient();
    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", profile.id)
      .eq("endpoint", endpoint);
    revalidatePath("/campo");
  });
}

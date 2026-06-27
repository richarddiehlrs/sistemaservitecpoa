"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeAction, type ActionResult } from "@/lib/action-result";

export async function atualizarUsuario(
  id: string,
  formData: FormData
): Promise<ActionResult> {
  return safeAction(async () => {
    const supabase = await createClient();
    const papel = String(formData.get("papel") || "atendente");
    const ativo = formData.get("ativo") === "true";
    const nome = String(formData.get("nome") || "").trim() || null;

    const { error } = await supabase
      .from("profiles")
      .update({ papel: papel as never, ativo, nome })
      .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/usuarios");
  });
}

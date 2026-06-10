"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function registrarAnexo(formData: FormData) {
  const supabase = await createClient();
  const os_id = String(formData.get("os_id"));
  const { error } = await supabase.from("os_anexos").insert({
    os_id,
    url: String(formData.get("url")),
    path: String(formData.get("path") || ""),
    momento: (String(formData.get("momento") || "antes")) as never,
    descricao: String(formData.get("descricao") || "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/ordens/${os_id}`);
}

export async function excluirAnexo(id: string, path: string, osId: string) {
  const supabase = await createClient();
  if (path) {
    await supabase.storage.from("os-fotos").remove([path]);
  }
  const { error } = await supabase.from("os_anexos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/ordens/${osId}`);
}

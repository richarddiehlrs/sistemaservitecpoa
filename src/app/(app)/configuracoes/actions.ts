"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

export async function salvarConfig(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("configuracoes")
    .update({
      nome: String(formData.get("nome") || "").trim() || "ServitecPoa",
      cnpj: str(formData.get("cnpj")),
      telefone: str(formData.get("telefone")),
      email: str(formData.get("email")),
      endereco: str(formData.get("endereco")),
      cidade: str(formData.get("cidade")),
      logo_url: str(formData.get("logo_url")),
      termo_garantia: str(formData.get("termo_garantia")),
      politica_os: str(formData.get("politica_os")),
      msg_whatsapp: str(formData.get("msg_whatsapp")),
    })
    .eq("id", 1);

  if (error) throw new Error(error.message);

  revalidatePath("/configuracoes");
  revalidatePath("/dashboard");
}

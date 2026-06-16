"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseNumForm } from "@/lib/format";

function num(v: FormDataEntryValue | null): number {
  return parseNumForm(v);
}

export async function salvarServico(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") || "");
  const dados = {
    descricao: String(formData.get("descricao") || "").trim(),
    tipo: (String(formData.get("tipo") || "servico")) as "servico" | "peca",
    valor: num(formData.get("valor")),
    ativo: formData.get("ativo") === "true",
  };
  if (!dados.descricao) return;

  if (id) {
    const { error } = await supabase.from("servicos_catalogo").update(dados).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("servicos_catalogo").insert(dados);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/catalogo");
}

export async function excluirServico(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("servicos_catalogo").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/catalogo");
}

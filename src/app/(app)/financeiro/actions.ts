"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function num(v: FormDataEntryValue | null): number {
  if (v == null) return 0;
  const s = String(v).replace(/\./g, "").replace(",", ".").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
function str(v: FormDataEntryValue | null): string | null {
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

export async function criarLancamento(formData: FormData) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const status = String(formData.get("status") || "pendente");

  const { error } = await supabase.from("lancamentos_financeiros").insert({
    tipo: String(formData.get("tipo") || "despesa") as "receita" | "despesa",
    descricao: String(formData.get("descricao") || "").trim() || "Lançamento",
    categoria_id: str(formData.get("categoria_id")),
    valor: num(formData.get("valor")),
    data_competencia: str(formData.get("data_competencia")) || hoje,
    data_vencimento: str(formData.get("data_vencimento")),
    data_pagamento: status === "pago" ? str(formData.get("data_pagamento")) || hoje : null,
    status,
    forma_pagamento: str(formData.get("forma_pagamento")),
    observacoes: str(formData.get("observacoes")),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/financeiro");
  revalidatePath("/dre");
}

export async function marcarPago(id: string) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({ status: "pago", data_pagamento: hoje })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/dre");
}

export async function cancelarLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamentos_financeiros")
    .update({ status: "cancelado" })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/dre");
}

export async function excluirLancamento(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("lancamentos_financeiros").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/financeiro");
  revalidatePath("/dre");
}

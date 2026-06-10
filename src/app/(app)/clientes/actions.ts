"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/format";

function parseCliente(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    const s = v == null ? "" : String(v).trim();
    return s === "" ? null : s;
  };

  return {
    tipo: (get("tipo") as "PF" | "PJ") || "PF",
    nome: String(formData.get("nome") || "").trim(),
    cpf_cnpj: get("cpf_cnpj") ? onlyDigits(get("cpf_cnpj")!) : null,
    rg_ie: get("rg_ie"),
    telefone: get("telefone") ? onlyDigits(get("telefone")!) : null,
    telefone2: get("telefone2") ? onlyDigits(get("telefone2")!) : null,
    email: get("email"),
    cep: get("cep") ? onlyDigits(get("cep")!) : null,
    logradouro: get("logradouro"),
    numero: get("numero"),
    complemento: get("complemento"),
    bairro: get("bairro"),
    cidade: get("cidade"),
    uf: get("uf"),
    ponto_referencia: get("ponto_referencia"),
    observacoes: get("observacoes"),
  };
}

export async function criarCliente(formData: FormData) {
  const dados = parseCliente(formData);
  if (!dados.nome) return;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert(dados)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  redirect(`/clientes/${data!.id}`);
}

export async function atualizarCliente(id: string, formData: FormData) {
  const dados = parseCliente(formData);
  if (!dados.nome) return;

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(dados).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

export async function excluirCliente(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/clientes");
  redirect("/clientes");
}

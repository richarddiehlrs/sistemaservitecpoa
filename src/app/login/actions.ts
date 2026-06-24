"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePorPapel, type Papel } from "@/lib/permissoes";
import { safeRedirectPath } from "@/lib/safe-redirect";

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = safeRedirectPath(String(formData.get("redirect") || "/dashboard"));

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciais inválidas. Verifique e-mail e senha." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  let destino = redirectTo;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("papel, ativo")
      .eq("id", user.id)
      .maybeSingle();
    if (profile && !profile.ativo) {
      await supabase.auth.signOut();
      return { error: "Conta inativa. Solicite liberação ao administrador." };
    }
    const papel = (profile?.papel as Papel) || "tecnico";
    destino = papel === "tecnico" ? homePorPapel("tecnico") : destino;
  }

  redirect(destino);
}

export async function signup(_prev: unknown, _formData: FormData) {
  return {
    error: "Cadastro público desabilitado. Solicite acesso ao administrador do sistema.",
  };
}

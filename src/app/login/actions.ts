"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePorPapel, type Papel } from "@/lib/permissoes";

export async function login(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = String(formData.get("redirect") || "/dashboard");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Credenciais inválidas. Verifique e-mail e senha." };
  }

  const { data: { user } } = await supabase.auth.getUser();
  let destino = redirectTo || "/dashboard";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("papel")
      .eq("id", user.id)
      .maybeSingle();
    const papel = (profile?.papel as Papel) || "admin";
    destino = papel === "tecnico" ? homePorPapel("tecnico") : destino;
  }

  redirect(destino);
}

export async function signup(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || password.length < 6) {
    return { error: "E-mail válido e senha de no mínimo 6 caracteres." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Cadastro realizado. Se a confirmação de e-mail estiver ativa, confirme antes de entrar.",
  };
}

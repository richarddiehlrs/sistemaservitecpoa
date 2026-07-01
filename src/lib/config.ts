import { createClient } from "@/lib/supabase/server";
import { EMPRESA } from "@/lib/utils";
import type { Configuracao, Profile } from "@/types/database";

export type EmpresaConfig = {
  nome: string;
  cnpj: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  logo_url: string | null;
  termo_garantia: string;
  politica_os: string;
  msg_whatsapp: string;
  comissao_percent: number;
  percentual_sinal_padrao: number;
};

// Carrega as configurações da empresa do banco, com fallback nas variáveis de ambiente.
export async function getConfig(): Promise<EmpresaConfig> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("configuracoes")
      .select("*")
      .eq("id", 1)
      .single();
    const c = data as Configuracao | null;
    return {
      nome: c?.nome || EMPRESA.nome,
      cnpj: c?.cnpj || EMPRESA.cnpj,
      telefone: c?.telefone || EMPRESA.telefone,
      email: c?.email || EMPRESA.email,
      endereco: c?.endereco || EMPRESA.endereco,
      cidade: c?.cidade || "",
      logo_url: c?.logo_url || null,
      termo_garantia: c?.termo_garantia || "",
      politica_os: c?.politica_os || "",
      msg_whatsapp:
        c?.msg_whatsapp ||
        'Olá! Aqui é da {empresa}. Sobre sua OS {os}: status "{status}".',
      comissao_percent: Number(c?.comissao_percent ?? 0),
      percentual_sinal_padrao: Number(c?.percentual_sinal_padrao ?? 50),
    };
  } catch {
    return {
      nome: EMPRESA.nome,
      cnpj: EMPRESA.cnpj,
      telefone: EMPRESA.telefone,
      email: EMPRESA.email,
      endereco: EMPRESA.endereco,
      cidade: "",
      logo_url: null,
      termo_garantia: "",
      politica_os: "",
      msg_whatsapp: 'Olá! Aqui é da {empresa}. Sobre sua OS {os}: status "{status}".',
      comissao_percent: 0,
      percentual_sinal_padrao: 50,
    };
  }
}

// Perfil do usuário logado (null se não houver tabela/registro).
export async function getCurrentProfile(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    return (data as Profile) || null;
  } catch {
    return null;
  }
}

// Papel efetivo — sem profile assume técnico (mais restritivo).
export async function getRole(): Promise<"admin" | "atendente" | "tecnico"> {
  const profile = await getCurrentProfile();
  return profile?.papel ?? "tecnico";
}

export type Papel = "admin" | "atendente" | "tecnico";

export type Permissao =
  | "dashboard"
  | "agenda"
  | "agenda_criar"
  | "agenda_checkin"
  | "ordens"
  | "ordens_criar"
  | "ordens_editar"
  | "ordens_excluir"
  | "clientes"
  | "clientes_criar"
  | "financeiro"
  | "financeiro_fluxo"
  | "financeiro_recorrentes"
  | "despesas_campo"
  | "campo_central"
  | "relatorios"
  | "dre"
  | "catalogo"
  | "usuarios"
  | "configuracoes";

const MATRIZ: Record<Papel, Permissao[]> = {
  admin: [
    "dashboard", "agenda", "agenda_criar", "agenda_checkin",
    "ordens", "ordens_criar", "ordens_editar", "ordens_excluir",
    "clientes", "clientes_criar",
    "financeiro", "financeiro_fluxo", "financeiro_recorrentes", "despesas_campo", "campo_central",
    "relatorios", "dre", "catalogo", "usuarios", "configuracoes",
  ],
  atendente: [
    "dashboard", "agenda", "agenda_criar", "agenda_checkin",
    "ordens", "ordens_criar", "ordens_editar", "ordens_excluir",
    "clientes", "clientes_criar",
    "financeiro", "financeiro_fluxo", "financeiro_recorrentes",
    "relatorios", "dre", "catalogo", "campo_central",
  ],
  tecnico: [
    "agenda", "agenda_checkin",
    "ordens", "ordens_criar", "ordens_editar",
    "clientes", "clientes_criar",
    "despesas_campo",
  ],
};

/** Página inicial após login conforme o papel. */
export function homePorPapel(papel: Papel): string {
  return papel === "tecnico" ? "/campo" : "/dashboard";
}

export function temPermissao(papel: Papel, perm: Permissao): boolean {
  return MATRIZ[papel]?.includes(perm) ?? false;
}

export function podeAcessarRota(papel: Papel, pathname: string): boolean {
  if (pathname.startsWith("/manutencao")) return temPermissao(papel, "ordens_excluir");
  if (pathname.startsWith("/configuracoes")) return temPermissao(papel, "configuracoes");
  if (pathname.startsWith("/usuarios")) return temPermissao(papel, "usuarios");
  if (pathname.startsWith("/catalogo")) return temPermissao(papel, "catalogo");
  if (pathname.startsWith("/dre")) return temPermissao(papel, "dre");
  if (pathname.startsWith("/relatorios")) return temPermissao(papel, "relatorios");
  if (pathname.startsWith("/financeiro/recorrentes")) return temPermissao(papel, "financeiro_recorrentes");
  if (pathname.startsWith("/financeiro/fluxo")) return temPermissao(papel, "financeiro_fluxo");
  if (pathname.startsWith("/financeiro")) return temPermissao(papel, "financeiro");
  if (pathname.startsWith("/campo"))
    return temPermissao(papel, "despesas_campo") || temPermissao(papel, "campo_central");
  if (pathname.startsWith("/clientes")) return temPermissao(papel, "clientes");
  if (pathname.startsWith("/ordens")) return temPermissao(papel, "ordens");
  if (pathname.startsWith("/agenda")) return temPermissao(papel, "agenda");
  if (pathname.startsWith("/dashboard")) return temPermissao(papel, "dashboard");
  return true;
}

export const PAPEL_LABEL: Record<Papel, string> = {
  admin: "Administrador",
  atendente: "Atendente",
  tecnico: "Técnico",
};

/** Nome do técnico usado em OS/agenda (profile.nome ou parte do e-mail). */
export function nomeTecnico(profile: { nome?: string | null; email?: string | null }): string {
  return profile.nome?.trim() || profile.email?.split("@")[0] || "Técnico";
}

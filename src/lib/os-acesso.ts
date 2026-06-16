import type { Profile } from "@/types/database";
import type { Papel } from "@/lib/permissoes";
import { nomeTecnico, temPermissao } from "@/lib/permissoes";

type OsAtribuicao = {
  tecnico_id: string | null;
  tecnico?: string | null;
};

/** Técnico atribuído à OS (por id ou nome legado). Admin/atendente sempre passam. */
export function osAtribuidaAoProfile(
  profile: Pick<Profile, "id" | "papel" | "nome" | "email">,
  os: OsAtribuicao
): boolean {
  if (profile.papel !== "tecnico") return true;
  if (os.tecnico_id && os.tecnico_id === profile.id) return true;
  const nome = nomeTecnico(profile).toLowerCase();
  const atribuido = os.tecnico?.trim().toLowerCase();
  if (!os.tecnico_id && atribuido && atribuido.includes(nome)) return true;
  return false;
}

export function assertOsAtribuida(
  profile: Pick<Profile, "id" | "papel" | "nome" | "email">,
  os: OsAtribuicao,
  msg = "Esta ordem não está atribuída a você."
): void {
  if (!osAtribuidaAoProfile(profile, os)) {
    throw new Error(msg);
  }
}

export function podeVerLucroOs(papel: Papel): boolean {
  return temPermissao(papel, "financeiro");
}

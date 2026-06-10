import type { Profile } from "@/types/database";
import { nomeTecnico } from "@/lib/permissoes";

export type TecnicoOpcao = { id: string; nome: string; email: string | null };

export function mapTecnicos(profiles: Profile[]): TecnicoOpcao[] {
  return profiles
    .filter((p) => p.papel === "tecnico" && p.ativo)
    .map((p) => ({
      id: p.id,
      nome: nomeTecnico(p),
      email: p.email,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

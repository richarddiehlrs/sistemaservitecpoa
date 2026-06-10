import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/config";
import { homePorPapel, podeAcessarRota, temPermissao, type Papel, type Permissao, nomeTecnico } from "@/lib/permissoes";
import type { Profile } from "@/types/database";

export async function requireProfile(): Promise<Profile & { papel: Papel }> {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }
  if (!profile.ativo) {
    redirect("/login?erro=conta_inativa");
  }
  return profile as Profile & { papel: Papel };
}

export async function requirePermissao(perm: Permissao): Promise<Profile & { papel: Papel }> {
  const profile = await requireProfile();
  if (!temPermissao(profile.papel, perm)) {
    redirect(`${homePorPapel(profile.papel)}?erro=sem_permissao`);
  }
  return profile;
}

export async function guardRota(pathname: string): Promise<(Profile & { papel: Papel }) | null> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.ativo) return null;
  if (!podeAcessarRota(profile.papel as Papel, pathname)) {
    redirect(`${homePorPapel(profile.papel as Papel)}?erro=sem_permissao`);
  }
  return profile as Profile & { papel: Papel };
}

export function tecnicoDoProfile(profile: Profile): string {
  return nomeTecnico(profile);
}

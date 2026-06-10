import { requireProfile } from "@/lib/auth-guard";
import { temPermissao } from "@/lib/permissoes";
import { CampoCentral } from "./campo-central";
import { CampoTecnico } from "./campo-tecnico";

export const dynamic = "force-dynamic";

export default async function CampoPage() {
  const profile = await requireProfile();

  if (temPermissao(profile.papel, "campo_central")) {
    return <CampoCentral />;
  }

  if (!temPermissao(profile.papel, "despesas_campo")) {
    const { redirect } = await import("next/navigation");
    const { homePorPapel } = await import("@/lib/permissoes");
    redirect(`${homePorPapel(profile.papel)}?erro=sem_permissao`);
  }

  return <CampoTecnico profile={profile} />;
}

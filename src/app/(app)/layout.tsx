import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/config";
import { nomeTecnico, type Papel } from "@/lib/permissoes";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login?erro=perfil");
  }

  return (
    <AppShell
      userEmail={user?.email}
      role={profile.papel as Papel}
      userId={profile?.id}
      userNome={profile ? nomeTecnico(profile) : undefined}
    >
      {children}
    </AppShell>
  );
}

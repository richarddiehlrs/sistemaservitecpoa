import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/config";
import { nomeTecnico } from "@/lib/permissoes";

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

  return (
    <AppShell
      userEmail={user?.email}
      role={profile?.papel ?? "admin"}
      userId={profile?.id}
      userNome={profile ? nomeTecnico(profile) : undefined}
    >
      {children}
    </AppShell>
  );
}

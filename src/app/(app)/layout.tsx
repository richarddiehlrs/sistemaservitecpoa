import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/config";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = await getRole();

  return (
    <AppShell userEmail={user?.email} role={role}>
      {children}
    </AppShell>
  );
}

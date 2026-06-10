import { Sidebar } from "@/components/sidebar";
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
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar userEmail={user?.email} role={role} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}

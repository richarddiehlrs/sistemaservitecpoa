import { PageHeader } from "@/components/ui";
import { PreferenciasAlertasForm, type PreferenciasAlertas } from "@/components/preferencias-alertas-form";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

const PADRAO: PreferenciasAlertas = {
  push_ativo: true,
  os_nova: true,
  os_aprovada: true,
  cliente_ausente: true,
  despesa_campo: true,
  financeiro: true,
  oficina_parada: true,
  meta_faturamento: true,
  email_resumo: false,
  dias_oficina_parada: 2,
};

export default async function AlertasConfigPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("preferencias_alertas")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  const prefs: PreferenciasAlertas = data ? { ...PADRAO, ...data } : PADRAO;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Alertas e notificações"
        subtitle="Configure quais avisos você deseja receber no sino, push e e-mail."
      />
      <PreferenciasAlertasForm prefs={prefs} />
    </div>
  );
}

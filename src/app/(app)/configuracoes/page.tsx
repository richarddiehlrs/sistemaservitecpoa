import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ConfigForm } from "@/components/config-form";
import { getConfig, getRole } from "@/lib/config";
import { salvarConfig } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage() {
  const [config, role] = await Promise.all([getConfig(), getRole()]);

  if (role !== "admin") {
    return (
      <div>
        <PageHeader title="Configurações" />
        <div className="card flex items-center gap-3 p-6 text-slate-600">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
          Apenas administradores podem alterar as configurações da empresa.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Dados da empresa, logo e textos que aparecem na OS"
      />
      <ConfigForm config={config} action={salvarConfig} />
    </div>
  );
}

import { PageHeader } from "@/components/ui";
import { CatalogoManager } from "@/components/catalogo-manager";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/config";
import { salvarServico, excluirServico } from "./actions";

export const dynamic = "force-dynamic";

export default async function CatalogoPage() {
  const supabase = await createClient();
  const [{ data: servicos }, role] = await Promise.all([
    supabase.from("servicos_catalogo").select("*").order("descricao"),
    getRole(),
  ]);

  return (
    <div>
      <PageHeader
        title="Catálogo de serviços"
        subtitle="Tabela de preços de serviços e peças para agilizar a abertura de OS"
      />
      <CatalogoManager
        servicos={servicos || []}
        podeEditar={role === "admin"}
        salvar={salvarServico}
        excluir={excluirServico}
      />
    </div>
  );
}

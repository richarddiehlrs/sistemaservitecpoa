import { PageHeader } from "@/components/ui";
import { OrdemForm } from "@/components/ordem-form";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { nomeTecnico } from "@/lib/permissoes";
import { criarOrdem } from "../actions";

export const dynamic = "force-dynamic";

export default async function NovaOrdemPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string }>;
}) {
  const { cliente: clienteId } = await searchParams;
  const profile = await requirePermissao("ordens_criar");
  const supabase = await createClient();
  const ehTecnico = profile.papel === "tecnico";

  const { data: catalogo } = await supabase
    .from("servicos_catalogo")
    .select("*")
    .eq("ativo", true)
    .order("descricao");

  let clienteInicial = null;
  let equipamentos = undefined;

  if (clienteId) {
    const { data: c } = await supabase
      .from("clientes")
      .select("id, nome, telefone")
      .eq("id", clienteId)
      .single();
    clienteInicial = c;
    if (c) {
      const { data: eq } = await supabase
        .from("equipamentos")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("created_at", { ascending: false });
      equipamentos = eq || [];
    }
  }

  return (
    <div>
      <PageHeader title="Nova ordem de serviço" subtitle="Abertura de atendimento" />
      <OrdemForm
        action={criarOrdem}
        clienteInicial={clienteInicial}
        equipamentos={equipamentos}
        catalogo={catalogo || []}
        tecnicoPadrao={ehTecnico ? nomeTecnico(profile) : undefined}
        tecnicoFixo={ehTecnico}
      />
    </div>
  );
}

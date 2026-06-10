import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { OrdemForm } from "@/components/ordem-form";
import { createClient } from "@/lib/supabase/server";
import { atualizarOrdem } from "../../actions";
import { formatNumeroOS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditarOrdemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("*, clientes(id, nome, telefone)")
    .eq("id", id)
    .single();

  if (!os) notFound();

  const [{ data: itens }, { data: equipamentos }] = await Promise.all([
    supabase.from("os_itens").select("*").eq("os_id", id).order("created_at"),
    supabase
      .from("equipamentos")
      .select("*")
      .eq("cliente_id", os.cliente_id)
      .order("created_at", { ascending: false }),
  ]);

  // @ts-expect-error relação embutida
  const clienteInicial = os.clientes;
  const action = atualizarOrdem.bind(null, id);

  return (
    <div>
      <PageHeader title={`Editar ${formatNumeroOS(os.numero)}`} subtitle="Atualização da ordem de serviço" />
      <OrdemForm
        action={action}
        ordem={os}
        clienteInicial={clienteInicial}
        equipamentos={equipamentos || []}
        itensIniciais={itens || []}
        modoEdicao
      />
    </div>
  );
}

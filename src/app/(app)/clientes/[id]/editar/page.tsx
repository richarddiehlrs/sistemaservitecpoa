import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { ClienteForm } from "@/components/cliente-form";
import { createClient } from "@/lib/supabase/server";
import { atualizarCliente } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();

  if (!cliente) notFound();

  const action = atualizarCliente.bind(null, id);

  return (
    <div>
      <PageHeader title="Editar cliente" subtitle={cliente.nome} />
      <ClienteForm cliente={cliente} action={action} />
    </div>
  );
}

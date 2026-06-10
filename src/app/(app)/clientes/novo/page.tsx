import { PageHeader } from "@/components/ui";
import { ClienteForm } from "@/components/cliente-form";
import { criarCliente } from "../actions";

export default function NovoClientePage() {
  return (
    <div>
      <PageHeader title="Novo cliente" subtitle="Preencha os dados do cliente" />
      <ClienteForm action={criarCliente} />
    </div>
  );
}

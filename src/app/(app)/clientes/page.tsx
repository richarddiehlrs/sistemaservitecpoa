import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { formatCpfCnpj, formatTelefone } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clientes")
    .select("id, nome, cpf_cnpj, telefone, cidade, uf")
    .order("nome");

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`nome.ilike.${term},cpf_cnpj.ilike.${term},telefone.ilike.${term}`);
  }

  const { data: clientes } = await query.limit(200);

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro e histórico de clientes"
        action={
          <Link href="/clientes/novo" className="btn-primary">
            <Plus className="h-4 w-4" /> Novo cliente
          </Link>
        }
      />

      <form className="mb-4" action="/clientes" method="get">
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Buscar por nome, CPF/CNPJ ou telefone..."
          className="input max-w-md"
        />
      </form>

      {!clientes || clientes.length === 0 ? (
        <EmptyState
          title="Nenhum cliente encontrado"
          description="Cadastre o primeiro cliente para começar."
          action={
            <Link href="/clientes/novo" className="btn-primary">
              <Plus className="h-4 w-4" /> Novo cliente
            </Link>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CPF / CNPJ</th>
                <th>Telefone</th>
                <th>Cidade</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">
                    <Link href={`/clientes/${c.id}`} className="text-brand-600 hover:underline">
                      {c.nome}
                    </Link>
                  </td>
                  <td>{c.cpf_cnpj ? formatCpfCnpj(c.cpf_cnpj) : "-"}</td>
                  <td>{c.telefone ? formatTelefone(c.telefone) : "-"}</td>
                  <td>{c.cidade ? `${c.cidade}/${c.uf ?? ""}` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

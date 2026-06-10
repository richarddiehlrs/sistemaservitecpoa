import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import { ClienteAcoes } from "@/components/cliente-acoes";
import { ExportCsv } from "@/components/export-csv";
import { formatCpfCnpj, formatTelefone } from "@/lib/format";
import { excluirCliente } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pagina = Math.max(1, parseInt(page || "1", 10) || 1);
  const supabase = await createClient();

  let query = supabase
    .from("clientes")
    .select("id, nome, cpf_cnpj, telefone, email, cidade, uf", { count: "exact" })
    .order("nome");

  if (q && q.trim()) {
    const term = `%${q.trim()}%`;
    query = query.or(`nome.ilike.${term},cpf_cnpj.ilike.${term},telefone.ilike.${term}`);
  }

  const from = (pagina - 1) * PAGE_SIZE;
  const { data: clientes, count } = await query.range(from, from + PAGE_SIZE - 1);

  const total = count || 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lista = clientes || [];

  const csvRows = lista.map((c) => [
    c.nome,
    c.cpf_cnpj ? formatCpfCnpj(c.cpf_cnpj) : "",
    c.telefone ? formatTelefone(c.telefone) : "",
    c.email ?? "",
    c.cidade ? `${c.cidade}/${c.uf ?? ""}` : "",
  ]);

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("page", String(p));
    return `/clientes?${sp.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${total} cliente(s) cadastrado(s)`}
        action={
          <>
            <ExportCsv
              filename="clientes.csv"
              headers={["Nome", "CPF/CNPJ", "Telefone", "E-mail", "Cidade"]}
              rows={csvRows}
            />
            <Link href="/clientes/novo" className="btn-primary">
              <Plus className="h-4 w-4" /> Novo cliente
            </Link>
          </>
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

      {lista.length === 0 ? (
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
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>CPF / CNPJ</th>
                  <th>Telefone</th>
                  <th>Cidade</th>
                  <th className="w-24 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium">
                      <Link href={`/clientes/${c.id}`} className="text-brand-600 hover:underline">
                        {c.nome}
                      </Link>
                    </td>
                    <td>{c.cpf_cnpj ? formatCpfCnpj(c.cpf_cnpj) : "-"}</td>
                    <td>{c.telefone ? formatTelefone(c.telefone) : "-"}</td>
                    <td>{c.cidade ? `${c.cidade}/${c.uf ?? ""}` : "-"}</td>
                    <td>
                      <ClienteAcoes clienteId={c.id} excluirAction={excluirCliente.bind(null, c.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Página {pagina} de {totalPaginas}
              </p>
              <div className="flex gap-2">
                <Link
                  href={buildHref(Math.max(1, pagina - 1))}
                  className={`btn-secondary ${pagina <= 1 ? "pointer-events-none opacity-50" : ""}`}
                >
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Link>
                <Link
                  href={buildHref(Math.min(totalPaginas, pagina + 1))}
                  className={`btn-secondary ${pagina >= totalPaginas ? "pointer-events-none opacity-50" : ""}`}
                >
                  Próxima <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

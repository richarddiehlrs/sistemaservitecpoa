import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth-guard";
import { nomeTecnico, temPermissao } from "@/lib/permissoes";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { ExportCsv } from "@/components/export-csv";
import { ExcluirOrdemButton } from "@/components/excluir-ordem-button";
import { STATUS_OS_LABEL, formatCurrency, formatDate, formatNumeroOS } from "@/lib/format";
import { excluirOrdem } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status, q, page } = await searchParams;
  const pagina = Math.max(1, parseInt(page || "1", 10) || 1);
  const profile = await requireProfile();
  const podeExcluirOs = temPermissao(profile.papel, "ordens_excluir");
  const supabase = await createClient();

  let query = supabase
    .from("ordens_servico")
    .select("id, numero, status, valor_total, data_abertura, defeito_relatado, clientes(nome)", { count: "exact" })
    .order("data_abertura", { ascending: false });

  if (status) query = query.eq("status", status);
  if (profile.papel === "tecnico") {
    const nome = nomeTecnico(profile);
    query = query.or(`tecnico.ilike.%${nome}%,tecnico.is.null`);
  }
  if (q && q.trim()) {
    const num = parseInt(q.replace(/\D/g, ""), 10);
    if (!Number.isNaN(num) && num > 0) query = query.eq("numero", num);
    else query = query.ilike("defeito_relatado", `%${q.trim()}%`);
  }

  const from = (pagina - 1) * PAGE_SIZE;
  const { data: ordens, count } = await query.range(from, from + PAGE_SIZE - 1);

  const total = count || 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const lista = ordens || [];

  const csvRows = lista.map((os) => [
    formatNumeroOS(os.numero),
    // @ts-expect-error relação
    os.clientes?.nome ?? "",
    os.defeito_relatado ?? "",
    formatDate(os.data_abertura),
    STATUS_OS_LABEL[os.status] || os.status,
    Number(os.valor_total).toFixed(2).replace(".", ","),
  ]);

  function buildHref(p: number) {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    sp.set("page", String(p));
    return `/ordens?${sp.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Ordens de Serviço"
        subtitle={`${total} ordem(ns) no total`}
        action={
          <>
            <ExportCsv
              filename="ordens-servico.csv"
              headers={["OS", "Cliente", "Defeito", "Abertura", "Status", "Total"]}
              rows={csvRows}
            />
            <Link href="/ordens/nova" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova OS
            </Link>
          </>
        }
      />

      {/* Busca */}
      <form className="mb-3" action="/ordens" method="get">
        {status && <input type="hidden" name="status" value={status} />}
        <input
          name="q"
          defaultValue={q || ""}
          placeholder="Buscar por número da OS ou defeito..."
          className="input max-w-md"
        />
      </form>

      {/* Filtros de status */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/ordens"
          className={`badge ${!status ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
        >
          Todas
        </Link>
        {Object.entries(STATUS_OS_LABEL).map(([key, label]) => (
          <Link
            key={key}
            href={`/ordens?status=${key}`}
            className={`badge ${status === key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {label}
          </Link>
        ))}
      </div>

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhuma ordem de serviço"
          description="Abra a primeira OS para iniciar um atendimento."
          action={
            <Link href="/ordens/nova" className="btn-primary">
              <Plus className="h-4 w-4" /> Nova OS
            </Link>
          }
        />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>OS</th>
                  <th>Cliente</th>
                  <th>Defeito</th>
                  <th>Abertura</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                  {podeExcluirOs && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {lista.map((os) => (
                  <tr key={os.id}>
                    <td className="font-medium">
                      <Link href={`/ordens/${os.id}`} className="text-brand-600 hover:underline">
                        {formatNumeroOS(os.numero)}
                      </Link>
                    </td>
                    {/* @ts-expect-error relação embutida */}
                    <td>{os.clientes?.nome ?? "-"}</td>
                    <td className="max-w-xs truncate">{os.defeito_relatado || "-"}</td>
                    <td>{formatDate(os.data_abertura)}</td>
                    <td><StatusBadge status={os.status} /></td>
                    <td className="text-right font-medium">{formatCurrency(os.valor_total)}</td>
                    {podeExcluirOs && (
                      <td className="text-right">
                        <ExcluirOrdemButton action={excluirOrdem.bind(null, os.id)} />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
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

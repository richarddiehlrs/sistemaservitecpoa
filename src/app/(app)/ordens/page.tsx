import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { STATUS_OS_LABEL, formatCurrency, formatDate, formatNumeroOS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function OrdensPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status, q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("ordens_servico")
    .select("id, numero, status, valor_total, data_abertura, defeito_relatado, clientes(nome)")
    .order("data_abertura", { ascending: false });

  if (status) query = query.eq("status", status);
  const { data: ordens } = await query.limit(200);

  return (
    <div>
      <PageHeader
        title="Ordens de Serviço"
        subtitle="Gestão completa de atendimentos"
        action={
          <Link href="/ordens/nova" className="btn-primary">
            <Plus className="h-4 w-4" /> Nova OS
          </Link>
        }
      />

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

      {!ordens || ordens.length === 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {ordens.map((os) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

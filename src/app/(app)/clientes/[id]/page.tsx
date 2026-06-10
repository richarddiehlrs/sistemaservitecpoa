import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Phone, Mail, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge } from "@/components/ui";
import {
  formatCpfCnpj,
  formatTelefone,
  formatCep,
  formatCurrency,
  formatDate,
  formatNumeroOS,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClienteDetalhePage({
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

  const [{ data: equipamentos }, { data: ordens }] = await Promise.all([
    supabase
      .from("equipamentos")
      .select("*")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("ordens_servico")
      .select("id, numero, status, valor_total, data_abertura, defeito_relatado")
      .eq("cliente_id", id)
      .order("data_abertura", { ascending: false }),
  ]);

  const endereco = [
    cliente.logradouro,
    cliente.numero,
    cliente.complemento,
    cliente.bairro,
    cliente.cidade && `${cliente.cidade}/${cliente.uf ?? ""}`,
    cliente.cep && `CEP ${formatCep(cliente.cep)}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div>
      <PageHeader
        title={cliente.nome}
        subtitle={cliente.tipo === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
        action={
          <div className="flex gap-2">
            <Link href={`/clientes/${id}/editar`} className="btn-secondary">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
            <Link href={`/ordens/nova?cliente=${id}`} className="btn-primary">
              <Plus className="h-4 w-4" /> Nova OS
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Coluna dados */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-500">Contato</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="h-4 w-4 text-slate-400" />
                {cliente.telefone ? formatTelefone(cliente.telefone) : "-"}
                {cliente.telefone2 && ` / ${formatTelefone(cliente.telefone2)}`}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="h-4 w-4 text-slate-400" />
                {cliente.email || "-"}
              </div>
              <div className="flex items-start gap-2 text-slate-700">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <span>{endereco || "Endereço não informado"}</span>
              </div>
            </dl>
            {cliente.cpf_cnpj && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                <span className="font-medium">CPF/CNPJ:</span>{" "}
                {formatCpfCnpj(cliente.cpf_cnpj)}
              </p>
            )}
            {cliente.observacoes && (
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-medium">Obs.:</span> {cliente.observacoes}
              </p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-500">
              Equipamentos ({equipamentos?.length ?? 0})
            </h3>
            {!equipamentos || equipamentos.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum equipamento cadastrado.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {equipamentos.map((e) => (
                  <li key={e.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-medium text-slate-800">
                      {e.tipo} {e.marca && `- ${e.marca}`} {e.modelo}
                    </p>
                    {e.numero_serie && (
                      <p className="text-xs text-slate-500">Série: {e.numero_serie}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Histórico de OS */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-900">
                Histórico de ordens de serviço ({ordens?.length ?? 0})
              </h3>
            </div>
            {!ordens || ordens.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">
                Este cliente ainda não possui ordens de serviço.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>OS</th>
                      <th>Data</th>
                      <th>Defeito</th>
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
                        <td>{formatDate(os.data_abertura)}</td>
                        <td className="max-w-xs truncate">{os.defeito_relatado || "-"}</td>
                        <td>
                          <StatusBadge status={os.status} />
                        </td>
                        <td className="text-right font-medium">
                          {formatCurrency(os.valor_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

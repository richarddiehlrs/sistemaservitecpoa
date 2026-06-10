import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OsAprovar } from "@/components/os-aprovar";
import { PrintButton } from "@/components/print-button";
import {
  formatCurrency,
  formatDate,
  formatNumeroOS,
  STATUS_OS_LABEL,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PortalOsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("os_publica", { p_token: token });
  const os = data as any;

  if (error || !os || !os.numero) notFound();

  const empresa = os.empresa || {};
  const itens: any[] = os.itens || [];
  const podeAprovar = !os.aprovado && os.status !== "cancelada";

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <PrintButton />
      <div className="mx-auto max-w-2xl px-4">
        {/* Cabeçalho da empresa */}
        <div className="card mb-4 flex items-center gap-3 p-5">
          {empresa.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt="logo" className="h-12 w-auto object-contain" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
              S
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900">{empresa.nome || "Assistência Técnica"}</h1>
            <p className="text-sm text-slate-500">
              {empresa.telefone} {empresa.email && `• ${empresa.email}`}
            </p>
          </div>
        </div>

        {/* Status */}
        <div className="card mb-4 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Ordem de Serviço</p>
              <p className="text-2xl font-bold text-slate-900">{formatNumeroOS(os.numero)}</p>
            </div>
            <div className="text-right">
              {os.aprovado ? (
                <span className="badge inline-flex items-center gap-1 bg-green-100 text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Aprovado
                </span>
              ) : (
                <span className="badge inline-flex items-center gap-1 bg-amber-100 text-amber-700">
                  <Clock className="h-4 w-4" /> {STATUS_OS_LABEL[os.status] || os.status}
                </span>
              )}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Info titulo="Cliente" valor={os.cliente_nome} />
            <Info titulo="Equipamento" valor={os.equipamento} />
            <Info titulo="Abertura" valor={formatDate(os.data_abertura)} />
            <Info titulo="Garantia" valor={`${os.garantia_dias} dias`} />
          </dl>

          {os.defeito && <Bloco titulo="Defeito relatado" valor={os.defeito} />}
          {os.diagnostico && <Bloco titulo="Diagnóstico" valor={os.diagnostico} />}
          {os.servico && <Bloco titulo="Serviço executado" valor={os.servico} />}
        </div>

        {/* Itens e total */}
        <div className="card mb-4 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="font-semibold text-slate-900">Orçamento</h2>
          </div>
          {itens.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-5 py-2">Descrição</th>
                  <th className="px-3 py-2 text-center">Qtd</th>
                  <th className="px-5 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="px-5 py-2">{it.descricao}</td>
                    <td className="px-3 py-2 text-center">{it.quantidade}</td>
                    <td className="px-5 py-2 text-right">{formatCurrency(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="space-y-1 border-t border-slate-200 px-5 py-3 text-sm">
            <Linha titulo="Serviços + peças" valor={formatCurrency(os.valor_itens)} />
            {os.acrescimo > 0 && <Linha titulo="Acréscimo" valor={`+ ${formatCurrency(os.acrescimo)}`} />}
            {os.desconto > 0 && <Linha titulo="Desconto" valor={`- ${formatCurrency(os.desconto)}`} />}
            <Linha
              titulo={`Visita técnica${os.abater_visita ? " (abatida)" : ""}`}
              valor={`${os.abater_visita ? "- " : ""}${formatCurrency(os.valor_visita)}`}
            />
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-bold text-brand-700">{formatCurrency(os.valor_total)}</span>
            </div>
          </div>
        </div>

        {/* Aprovação */}
        {podeAprovar ? (
          <div className="card p-5 no-print">
            <h2 className="mb-3 font-semibold text-slate-900">Aprovar orçamento</h2>
            <OsAprovar token={token} />
          </div>
        ) : os.aprovado ? (
          <div className="card flex items-center gap-2 p-5 text-green-700">
            <CheckCircle2 className="h-5 w-5" />
            Orçamento aprovado em {formatDate(os.data_aprovacao)}. Obrigado!
          </div>
        ) : null}

        {empresa.termo_garantia && (
          <p className="mt-4 px-2 text-center text-xs text-slate-400">{empresa.termo_garantia}</p>
        )}
      </div>
    </div>
  );
}

function Info({ titulo, valor }: { titulo: string; valor?: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{titulo}</dt>
      <dd className="font-medium text-slate-800">{valor || "-"}</dd>
    </div>
  );
}
function Bloco({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase text-slate-400">{titulo}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{valor}</p>
    </div>
  );
}
function Linha({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between text-slate-600">
      <span>{titulo}</span>
      <span>{valor}</span>
    </div>
  );
}

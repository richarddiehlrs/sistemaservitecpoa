import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Printer, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ImageIcon, PenLine, Link2 } from "lucide-react";
import { OsStatusControl } from "@/components/os-status-control";
import { OsShare } from "@/components/os-share";
import { OsFotos } from "@/components/os-fotos";
import { OsAssinatura } from "@/components/os-assinatura";
import { CopyLink } from "@/components/copy-link";
import { getConfig } from "@/lib/config";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumeroOS,
  formatTelefone,
} from "@/lib/format";
import { alterarStatusForm, lancarFinanceiro } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrdemDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("*, clientes(*), equipamentos(*)")
    .eq("id", id)
    .single();

  if (!os) notFound();

  const [{ data: itens }, { data: historico }, { data: lancamentos }, { data: anexos }, config] =
    await Promise.all([
      supabase.from("os_itens").select("*").eq("os_id", id).order("created_at"),
      supabase
        .from("os_status_historico")
        .select("*")
        .eq("os_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("lancamentos_financeiros")
        .select("*")
        .eq("os_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("os_anexos").select("*").eq("os_id", id).order("created_at"),
      getConfig(),
    ]);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const portalUrl = siteUrl ? `${siteUrl}/os/${os.aprovacao_token}` : "";

  // @ts-expect-error relação embutida
  const cliente = os.clientes;
  // @ts-expect-error relação embutida
  const equip = os.equipamentos;

  const statusAction = alterarStatusForm.bind(null, id);
  const financeiroAction = lancarFinanceiro.bind(null, id);

  return (
    <div>
      <PageHeader
        title={`Ordem ${formatNumeroOS(os.numero)}`}
        subtitle={`Aberta em ${formatDateTime(os.data_abertura)}`}
        action={
          <div className="flex gap-2">
            <Link href={`/imprimir/os/${id}`} target="_blank" className="btn-secondary">
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Link>
            <Link href={`/ordens/${id}/editar`} className="btn-primary">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Conteúdo principal */}
        <div className="space-y-6 lg:col-span-2">
          {/* Cliente e equipamento */}
          <div className="card p-5">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Cliente</h3>
                <Link href={`/clientes/${cliente?.id}`} className="font-medium text-brand-600 hover:underline">
                  {cliente?.nome}
                </Link>
                <p className="text-sm text-slate-600">{cliente?.telefone ? formatTelefone(cliente.telefone) : ""}</p>
                <p className="text-sm text-slate-500">
                  {[cliente?.logradouro, cliente?.numero, cliente?.bairro, cliente?.cidade]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">Equipamento</h3>
                {equip ? (
                  <>
                    <p className="font-medium text-slate-800">
                      {equip.tipo} {equip.marca && `- ${equip.marca}`} {equip.modelo}
                    </p>
                    <p className="text-sm text-slate-500">
                      {equip.numero_serie && `Série: ${equip.numero_serie}`}{" "}
                      {equip.voltagem && `• ${equip.voltagem}`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">Não informado</p>
                )}
              </div>
            </div>
          </div>

          {/* Atendimento */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Atendimento</h3>
            <dl className="space-y-3 text-sm">
              <Campo titulo="Defeito relatado" valor={os.defeito_relatado} />
              <Campo titulo="Acompanha" valor={os.acompanha} />
              <Campo titulo="Estado do aparelho" valor={os.estado_aparelho} />
              <Campo titulo="Diagnóstico" valor={os.diagnostico} />
              <Campo titulo="Serviço executado" valor={os.servico_executado} />
              <Campo titulo="Observações" valor={os.observacoes} />
            </dl>
          </div>

          {/* Itens */}
          <div className="card">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="font-semibold text-slate-900">Serviços e peças</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th className="text-right">Qtd</th>
                    <th className="text-right">Valor unit.</th>
                    <th className="text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(itens || []).map((it) => (
                    <tr key={it.id}>
                      <td className="capitalize">{it.tipo}</td>
                      <td>{it.descricao}</td>
                      <td className="text-right">{it.quantidade}</td>
                      <td className="text-right">{formatCurrency(it.valor_unitario)}</td>
                      <td className="text-right font-medium">{formatCurrency(it.subtotal)}</td>
                    </tr>
                  ))}
                  {(!itens || itens.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center text-slate-400">
                        Nenhum item lançado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 border-t border-slate-200 px-5 py-4 text-sm">
              <Linha titulo="Serviços + peças" valor={formatCurrency(os.valor_itens)} />
              {os.acrescimo > 0 && <Linha titulo="Acréscimo" valor={`+ ${formatCurrency(os.acrescimo)}`} />}
              {os.desconto > 0 && <Linha titulo="Desconto" valor={`- ${formatCurrency(os.desconto)}`} />}
              <Linha
                titulo={`Visita técnica${os.abater_visita ? " (abatida)" : ""}`}
                valor={`${os.abater_visita ? "- " : ""}${formatCurrency(os.valor_visita)}`}
              />
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-base font-semibold">Total</span>
                <span className="text-xl font-bold text-brand-700">
                  {formatCurrency(os.valor_total)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lateral */}
        <div className="space-y-6">
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Status</h3>
              <StatusBadge status={os.status} />
            </div>
            <OsStatusControl statusAtual={os.status} action={statusAction} />
          </div>

          {/* Enviar ao cliente */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Enviar ao cliente</h3>
            <OsShare
              numero={os.numero}
              status={os.status}
              clienteNome={cliente?.nome}
              clienteTelefone={cliente?.telefone}
              clienteEmail={cliente?.email}
              equipamento={equip ? `${equip.tipo} ${equip.marca ?? ""} ${equip.modelo ?? ""}`.trim() : null}
              defeito={os.defeito_relatado}
              valorTotal={os.valor_total}
              garantiaDias={os.garantia_dias}
              previsao={os.data_previsao}
              msgTemplate={config.msg_whatsapp}
              clienteNomeRaw={cliente?.nome}
              empresaNome={config.nome}
            />
            {portalUrl && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500">
                  <Link2 className="h-3.5 w-3.5" /> Link do portal do cliente
                </p>
                <CopyLink url={portalUrl} />
                {os.aprovado && (
                  <p className="mt-1 text-xs font-medium text-green-600">
                    ✓ Orçamento aprovado pelo cliente em {formatDate(os.data_aprovacao)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Fotos / anexos */}
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <ImageIcon className="h-4 w-4" /> Fotos do equipamento
            </h3>
            <OsFotos osId={id} anexos={anexos || []} />
          </div>

          {/* Assinatura */}
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <PenLine className="h-4 w-4" /> Assinatura do cliente
            </h3>
            <OsAssinatura osId={id} assinaturaAtual={os.assinatura_cliente} />
          </div>

          {/* Financeiro */}
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <DollarSign className="h-4 w-4" /> Financeiro
            </h3>
            {lancamentos && lancamentos.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {lancamentos.map((l) => (
                  <li key={l.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span className={l.status === "pago" ? "text-green-600" : "text-amber-600"}>
                      {l.status === "pago" ? "Recebido" : "A receber"}
                    </span>
                    <span className="font-medium">{formatCurrency(l.valor)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <form action={financeiroAction} className="space-y-2">
                <select name="status_pagamento" className="input" defaultValue="pendente">
                  <option value="pendente">A receber (pendente)</option>
                  <option value="pago">Já recebido (pago)</option>
                </select>
                <input type="date" name="data_vencimento" className="input" />
                <button className="btn-primary w-full">
                  Lançar {formatCurrency(os.valor_total)}
                </button>
              </form>
            )}
          </div>

          {/* Histórico */}
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">Histórico</h3>
            <ol className="space-y-3">
              {(historico || []).map((h) => (
                <li key={h.id} className="border-l-2 border-brand-200 pl-3">
                  <StatusBadge status={h.status} />
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(h.created_at)}</p>
                  {h.observacao && <p className="text-sm text-slate-600">{h.observacao}</p>}
                </li>
              ))}
            </ol>
          </div>

          <div className="card p-5 text-sm text-slate-600">
            <p><span className="font-medium">Técnico:</span> {os.tecnico || "-"}</p>
            <p><span className="font-medium">Previsão:</span> {formatDate(os.data_previsao)}</p>
            <p><span className="font-medium">Garantia:</span> {os.garantia_dias} dias</p>
            <p><span className="font-medium">Pagamento:</span> {os.forma_pagamento || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ titulo, valor }: { titulo: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-400">{titulo}</dt>
      <dd className="whitespace-pre-wrap text-slate-700">{valor}</dd>
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

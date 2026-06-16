import { notFound } from "next/navigation";
import { CheckCircle2, Clock, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { OsAprovar } from "@/components/os-aprovar";
import { PortalQrCodes } from "@/components/portal-qr-codes";
import { PortalAcompanhamento } from "@/components/portal-visita";
import { PortalRetornoAgendado } from "@/components/portal-retorno-agendado";
import { PortalNps } from "@/components/portal-nps";
import { PrintButton } from "@/components/print-button";
import {
  formatCurrency,
  formatCpfCnpj,
  formatDate,
  formatDateTime,
  formatNumeroOS,
  formatTelefone,
  STATUS_OS_LABEL,
} from "@/lib/format";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { podeAprovarOrcamentoPortal } from "@/lib/portal-aprovacao";
import { OrcamentoResumoCliente } from "@/components/orcamento-resumo-cliente";

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
  const anexosAusente: { url: string }[] = os.anexos_ausente || [];
  const historico: { status: string; observacao?: string | null; created_at: string }[] =
    os.historico || [];
  const equips: { tipo?: string; marca?: string; modelo?: string; numero_serie?: string; voltagem?: string }[] =
    os.equipamentos || [];
  const ehClienteAusente = os.status === "cliente_ausente";
  const valorTotal = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  const podeAprovar = podeAprovarOrcamentoPortal({
    aprovado: Boolean(os.aprovado),
    status: os.status,
    valorTotal,
  });
  const proximoAgendamento = os.proximo_agendamento as {
    data?: string;
    hora_inicio?: string | null;
    turno?: string | null;
    endereco?: string | null;
  } | null;
  const nps = os.nps as { nota?: number; comentario?: string | null } | null;
  const mostrarNps = ["concluida", "entregue"].includes(os.status);

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <PrintButton href={`/imprimir/portal/${token}`} />
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
                <div className="flex flex-col items-end gap-1">
                  <span className="badge inline-flex items-center gap-1 bg-green-100 text-green-700">
                    <CheckCircle2 className="h-4 w-4" /> Orçamento aprovado
                  </span>
                  {!["concluida", "entregue", "cancelada"].includes(os.status) && (
                    <span className="text-xs text-slate-500">
                      {STATUS_OS_LABEL[os.status] || os.status}
                    </span>
                  )}
                </div>
              ) : (
                <span className="badge inline-flex items-center gap-1 bg-amber-100 text-amber-700">
                  <Clock className="h-4 w-4" /> {STATUS_OS_LABEL[os.status] || os.status}
                </span>
              )}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Info titulo="Cliente" valor={os.cliente?.nome || os.cliente_nome} />
            {os.cliente?.cpf_cnpj && <Info titulo="CPF/CNPJ" valor={formatCpfCnpj(os.cliente.cpf_cnpj)} />}
            {os.cliente?.telefone && <Info titulo="Telefone" valor={formatTelefone(os.cliente.telefone)} />}
            {equips.length > 1 ? (
              <div className="col-span-2">
                <dt className="text-xs text-slate-500">Equipamentos ({equips.length})</dt>
                <dd className="font-medium text-slate-800">
                  <ul className="mt-1 list-inside list-decimal space-y-0.5 text-sm">
                    {equips.map((e, i) => (
                      <li key={i}>
                        {[e.tipo, e.marca, e.modelo].filter(Boolean).join(" ")}
                        {e.numero_serie && ` • S/N ${e.numero_serie}`}
                        {e.voltagem && ` • ${e.voltagem}`}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : (
              <>
                <Info titulo="Equipamento" valor={os.equipamento} />
                {os.equipamento_detalhe?.numero_serie && (
                  <Info titulo="Nº série" valor={os.equipamento_detalhe.numero_serie} />
                )}
                {os.equipamento_detalhe?.voltagem && (
                  <Info titulo="Voltagem" valor={os.equipamento_detalhe.voltagem} />
                )}
              </>
            )}
            <Info titulo="Abertura" valor={formatDate(os.data_abertura)} />
            <Info titulo="Garantia" valor={`${os.garantia_dias} dias`} />
            {os.tecnico && <Info titulo="Técnico" valor={os.tecnico} />}
          </dl>

          {os.defeito && <Bloco titulo="Defeito relatado" valor={os.defeito} />}
          {os.diagnostico && <Bloco titulo="Diagnóstico" valor={os.diagnostico} />}
          {os.servico && <Bloco titulo="Serviço executado" valor={os.servico} />}
        </div>

        <PortalRetornoAgendado agendamento={proximoAgendamento} />

        <PortalAcompanhamento
          status={os.status}
          aprovado={Boolean(os.aprovado)}
          dataAprovacao={os.data_aprovacao}
          dataPrevisao={os.data_previsao}
          turno={os.turno}
          tecnico={os.tecnico}
          historico={historico}
          proximoAgendamento={proximoAgendamento}
        />

        {/* Cliente ausente */}
        {ehClienteAusente && (
          <div className="card mb-4 border-rose-200 bg-rose-50/60 p-5">
            <div className="mb-3 flex items-center gap-2 text-rose-800">
              <UserX className="h-5 w-5" />
              <h2 className="font-semibold">Cliente ausente na visita</h2>
            </div>
            <p className="text-sm text-slate-600">
              O técnico registrou que não foi possível realizar o atendimento por ausência do cliente.
            </p>
            {os.cliente_ausente_registrado_at && (
              <p className="mt-2 text-xs text-slate-500">
                Registrado em {formatDateTime(os.cliente_ausente_registrado_at)}
              </p>
            )}
            {os.observacao_cliente_ausente && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{os.observacao_cliente_ausente}</p>
            )}
            {os.assinatura_tecnico && (
              <div className="mt-3 rounded-lg border bg-white p-3">
                <p className="mb-1 text-xs text-slate-500">Assinatura do técnico</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={os.assinatura_tecnico} alt="Assinatura técnico" className="h-16 object-contain" />
              </div>
            )}
            {anexosAusente.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold text-slate-500">Foto comprobatória</p>
                <div className="flex flex-wrap gap-2">
                  {anexosAusente.map((a, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={a.url} alt="Comprovante" className="h-24 w-24 rounded-lg border object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

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
          <div className="border-t border-slate-200 px-5 py-3">
            <OrcamentoResumoCliente
              valor_itens={Number(os.valor_itens)}
              valor_visita={Number(os.valor_visita)}
              abater_visita={Boolean(os.abater_visita)}
              desconto={Number(os.desconto)}
              acrescimo={Number(os.acrescimo)}
            />
          </div>
        </div>

        <PortalQrCodes
          empresaNome={empresa.nome || "Assistência Técnica"}
          valorTotal={valorTotal}
        />

        {mostrarNps && (
          <PortalNps
            token={token}
            notaInicial={nps?.nota ?? null}
            comentarioInicial={nps?.comentario ?? null}
          />
        )}

        {/* Aprovação */}
        {podeAprovar ? (
          <div className="card p-5 no-print">
            <h2 className="mb-3 font-semibold text-slate-900">Aprovar orçamento</h2>
            <OsAprovar token={token} />
          </div>
        ) : os.aprovado ? (
          <div className="card space-y-3 p-5 text-green-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Orçamento aprovado em {formatDate(os.data_aprovacao)}. Obrigado!
            </div>
            {(os.assinatura_cliente || os.assinatura_tecnico) && (
              <div className="grid grid-cols-1 gap-3 border-t border-green-200 pt-3 sm:grid-cols-2">
                {os.assinatura_cliente && (
                  <div className="rounded-lg border bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">Assinatura do cliente</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={os.assinatura_cliente} alt="Assinatura cliente" className="h-16 object-contain" />
                  </div>
                )}
                {os.assinatura_tecnico && (
                  <div className="rounded-lg border bg-white p-3">
                    <p className="mb-1 text-xs text-slate-500">Assinatura do técnico</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={os.assinatura_tecnico} alt="Assinatura técnico" className="h-16 object-contain" />
                  </div>
                )}
              </div>
            )}
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

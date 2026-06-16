import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Printer, DollarSign, Trash2, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge } from "@/components/ui";
import { ImageIcon, PenLine, Link2 } from "lucide-react";
import { OsStatusControl } from "@/components/os-status-control";
import { OsShare } from "@/components/os-share";
import { WhatsAppStatusCliente } from "@/components/whatsapp-status-cliente";
import { OsFotos } from "@/components/os-fotos";
import { OsAssinatura } from "@/components/os-assinatura";
import { OsAssinaturaTecnico } from "@/components/os-assinatura-tecnico";
import { OsClienteAusente } from "@/components/os-cliente-ausente";
import { CopyLink } from "@/components/copy-link";
import { ConfirmButton } from "@/components/confirm-button";
import { LancamentoAcoes } from "@/components/lancamento-acoes";
import { getConfig } from "@/lib/config";
import { requireProfile } from "@/lib/auth-guard";
import { osAtribuidaAoProfile, podeVerLucroOs } from "@/lib/os-acesso";
import { temPermissao } from "@/lib/permissoes";
import { TURNO_LABEL } from "@/lib/turnos";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatHora,
  formatNumeroOS,
  formatTelefone,
  STATUS_AGENDAMENTO_LABEL,
  TIPO_AGENDAMENTO_LABEL,
} from "@/lib/format";
import { carregarEquipamentosOs, textoEquipamentos } from "@/lib/os-equipamentos";
import { calcValorTotalCliente } from "@/lib/os-valores";
import { dataFimGarantiaOs, isRetornoGarantia, podeAbrirRetornoGarantia } from "@/lib/os-garantia";
import { AbrirRetornoGarantia } from "@/components/abrir-retorno-garantia";
import { podeAprovarOrcamentoPortal } from "@/lib/portal-aprovacao";
import { OrcamentoResumoCliente } from "@/components/orcamento-resumo-cliente";
import { saldoEmAberto, valorDevido } from "@/lib/financeiro";
import { calcLucroOs } from "@/lib/metricas-financeiras";
import { atualizarLancamento, excluirLancamento } from "@/app/(app)/financeiro/actions";
import { transicoesPermitidas } from "@/lib/transicao-status";
import type { StatusOS } from "@/types/database";
import { alterarStatusForm, abrirRetornoGarantia, excluirOrdem, lancarFinanceiro, registrarClienteAusente } from "../actions";
import { OsEtiquetaPrompt } from "@/components/os-etiqueta-prompt";

export const dynamic = "force-dynamic";

export default async function OrdemDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ etiqueta?: string }>;
}) {
  const { id } = await params;
  const { etiqueta } = await searchParams;
  const profile = await requireProfile();
  const podeExcluirOs = temPermissao(profile.papel, "ordens_excluir");
  const podeFinanceiro = temPermissao(profile.papel, "financeiro");
  const mostrarLucro = podeVerLucroOs(profile.papel);
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("*, clientes(*), equipamentos(*)")
    .eq("id", id)
    .single();

  if (!os) notFound();

  if (profile.papel === "tecnico" && !osAtribuidaAoProfile(profile, { tecnico_id: os.tecnico_id, tecnico: os.tecnico })) {
    redirect("/campo?erro=os_nao_atribuida");
  }

  const [
    { data: itens },
    { data: historico },
    { data: lancamentos },
    { data: anexos },
    { data: categorias },
    { data: agendamentos },
    config,
    equipamentosOs,
  ] = await Promise.all([
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
      supabase.from("categorias_financeiras").select("*").order("nome"),
      supabase
        .from("agendamentos")
        .select("*")
        .eq("os_id", id)
        .order("data", { ascending: false }),
      getConfig(),
      carregarEquipamentosOs(supabase, id),
    ]);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const portalUrl = siteUrl ? `${siteUrl}/os/${os.aprovacao_token}` : "";

  // @ts-expect-error relação embutida
  const cliente = os.clientes;
  // @ts-expect-error relação embutida
  const equip = os.equipamentos;
  const equips = equipamentosOs.length > 0 ? equipamentosOs : equip ? [equip] : [];

  const valorTotal = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );

  const lancamentosAtivos = (lancamentos || []).filter((l) => l.status !== "cancelado");
  const lucroOs = calcLucroOs(lancamentosAtivos);

  const statusAction = alterarStatusForm.bind(null, id);
  const transicoesStatus = transicoesPermitidas(os.status as StatusOS, profile.papel);
  const podeEditarOs =
    profile.papel === "admin" ||
    !["concluida", "entregue", "cancelada"].includes(os.status);
  const financeiroAction = lancarFinanceiro.bind(null, id);
  const clienteAusenteAction = registrarClienteAusente.bind(null, id);
  const ehTecnico = profile.papel === "tecnico";
  const statusFinalizado = ["cancelada", "entregue", "concluida"].includes(os.status);
  const podeAssinarTecnico = ehTecnico && !statusFinalizado;
  const podeRegistrarAusente =
    ehTecnico &&
    !["cliente_ausente", "cancelada", "entregue", "concluida"].includes(os.status);

  const podeAprovarOrcamento = podeAprovarOrcamentoPortal({
    aprovado: Boolean(os.aprovado),
    status: os.status,
    valorTotal,
  });
  const jaFoiAprovada = (historico || []).some((h) => h.status === "aprovada");
  const valorMudouAposAprovacao =
    os.aprovado &&
    os.valor_aprovado != null &&
    Math.abs(valorTotal - Number(os.valor_aprovado)) > 0.01;
  const aguardaNovaAprovacao =
    !os.aprovado && os.status === "aguardando_aprovacao" && jaFoiAprovada && valorTotal > 0;
  const receitaSemAprovacao =
    !os.aprovado &&
    lancamentosAtivos.some(
      (l) => l.tipo === "receita" && !["cancelado", "pago"].includes(l.status)
    );
  const ehOficina = os.tipo_atendimento === "oficina";
  const retornoGarantia = isRetornoGarantia(os);
  const abrirRetorno = podeAbrirRetornoGarantia(os as never);
  const fimGarantia = dataFimGarantiaOs(os);
  const podeAbrirRetornoGarantiaBtn =
    !ehTecnico && temPermissao(profile.papel, "ordens_editar") && abrirRetorno.ok;

  let osOrigemNumero: number | null = null;
  if (os.os_origem_id) {
    const { data: origem } = await supabase
      .from("ordens_servico")
      .select("numero")
      .eq("id", os.os_origem_id)
      .maybeSingle();
    osOrigemNumero = origem?.numero ?? null;
  }

  return (
    <div>
      {receitaSemAprovacao && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          Há receita pendente no financeiro sem orçamento aprovado. Reaprove o orçamento ou cancele o lançamento manualmente.
        </div>
      )}
      {aguardaNovaAprovacao && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Orçamento alterado após aprovação anterior. Solicite nova assinatura do cliente antes de concluir o serviço.
        </div>
      )}
      {valorMudouAposAprovacao && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          O orçamento foi alterado após a última aprovação. Solicite nova assinatura do cliente antes de concluir.
        </div>
      )}
      {retornoGarantia && (
        <div className="mb-4 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <strong>Retorno em garantia</strong>
          {osOrigemNumero != null && (
            <>
              {" "}
              — vinculada à{" "}
              <Link href={`/ordens/${os.os_origem_id}`} className="font-medium underline">
                OS {formatNumeroOS(osOrigemNumero)}
              </Link>
            </>
          )}
          . Custo registrado como prejuízo; informe o pagamento do cliente ao concluir no check-out ou no financeiro.
        </div>
      )}
      <PageHeader
        title={`Ordem ${formatNumeroOS(os.numero)}`}
        subtitle={`Aberta em ${formatDateTime(os.data_abertura)}${ehOficina ? " · Oficina" : ""}${retornoGarantia ? " · Retorno garantia" : ""}`}
        eyebrow={retornoGarantia ? "Retorno em garantia" : undefined}
        action={
          <div className="flex flex-wrap gap-2">
            {ehOficina && (
              <Link href={`/imprimir/etiqueta-os/${id}`} target="_blank" className="btn-secondary">
                <QrCode className="h-4 w-4" /> Etiqueta QR
              </Link>
            )}
            <Link href={`/imprimir/os/${id}`} target="_blank" className="btn-secondary">
              <Printer className="h-4 w-4" /> Imprimir / PDF
            </Link>
            {podeEditarOs && (
              <Link href={`/ordens/${id}/editar`} className="btn-primary">
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            )}
            {podeExcluirOs && (
              <ConfirmButton
                action={excluirOrdem.bind(null, id)}
                className="btn-danger"
                title="Excluir ordem de serviço"
                message="Deseja excluir esta ordem de serviço permanentemente? Agendamentos, lançamentos financeiros e todos os dados vinculados serão removidos."
                confirmLabel="Excluir OS"
                successMsg="Ordem excluída."
              >
                <Trash2 className="h-4 w-4" /> Excluir
              </ConfirmButton>
            )}
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
                <h3 className="mb-2 text-xs font-semibold uppercase text-slate-400">
                  {equips.length > 1 ? `Equipamentos (${equips.length})` : "Equipamento"}
                </h3>
                {equips.length > 0 ? (
                  <ul className="space-y-2">
                    {equips.map((e, i) => (
                      <li key={e.id || i}>
                        <p className="font-medium text-slate-800">
                          {equips.length > 1 && <span className="text-slate-400">{i + 1}. </span>}
                          {e.tipo} {e.marca && `- ${e.marca}`} {e.modelo}
                        </p>
                        <p className="text-sm text-slate-500">
                          {e.numero_serie && `Série: ${e.numero_serie}`}{" "}
                          {e.voltagem && `• ${e.voltagem}`}
                          {e.cor && ` • ${e.cor}`}
                        </p>
                      </li>
                    ))}
                  </ul>
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
            <div className="border-t border-slate-200 px-5 py-4">
              <OrcamentoResumoCliente
                valor_itens={Number(os.valor_itens)}
                valor_visita={Number(os.valor_visita)}
                abater_visita={Boolean(os.abater_visita)}
                desconto={Number(os.desconto)}
                acrescimo={Number(os.acrescimo)}
              />
              {mostrarLucro && (
              <div className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
                <Linha titulo="Custo total (peças/serviços)" valor={formatCurrency(os.custo_total || 0)} />
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-slate-700">Lucro líquido</span>
                  <span className={(valorTotal - (os.custo_total || 0)) >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatCurrency(valorTotal - (os.custo_total || 0))}
                  </span>
                </div>
              </div>
              )}
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
            <OsStatusControl
              statusAtual={os.status}
              action={statusAction}
              transicoesPermitidas={transicoesStatus}
            />
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
              equipamento={equips.length ? textoEquipamentos(equips) : null}
              defeito={os.defeito_relatado}
              valorTotal={valorTotal}
              garantiaDias={os.garantia_dias}
              previsao={os.data_previsao}
              msgTemplate={config.msg_whatsapp}
              clienteNomeRaw={cliente?.nome}
              empresaNome={config.nome}
              portalUrl={portalUrl}
            />
            <div className="mt-4 border-t border-slate-100 pt-4">
              <WhatsAppStatusCliente
                telefone={cliente?.telefone}
                clienteNome={cliente?.nome}
                numero={os.numero}
                status={os.status}
                valorTotal={valorTotal}
                portalUrl={portalUrl}
                dataPrevisao={os.data_previsao}
                turno={os.turno}
                horaInicio={agendamentos?.[0]?.hora_inicio}
                tecnico={os.tecnico}
                empresaNome={config.nome}
                msgTemplate={config.msg_whatsapp}
              />
            </div>
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

          {/* Assinatura técnico — sempre */}
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <PenLine className="h-4 w-4" /> Assinatura do técnico
            </h3>
            <p className="mb-3 text-xs text-slate-500">
              O técnico responsável deve assinar ao concluir o atendimento.
            </p>
            <OsAssinaturaTecnico
              osId={id}
              assinaturaAtual={os.assinatura_tecnico}
              somenteLeitura={!podeAssinarTecnico}
            />
          </div>

          {/* Assinatura cliente */}
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <PenLine className="h-4 w-4" /> Assinatura do cliente
            </h3>
            <OsAssinatura
              osId={id}
              assinaturaAtual={os.assinatura_cliente}
              podeAprovar={podeAprovarOrcamento}
              aprovado={os.aprovado}
            />
          </div>

          {/* Agenda vinculada (automática) */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Agenda do técnico</h3>
              <Link href="/agenda" className="text-xs text-brand-600 hover:underline">Ver agenda completa</Link>
            </div>
            {(agendamentos || []).length === 0 ? (
              <p className="text-sm text-slate-400">
                {profile.papel !== "tecnico"
                  ? "Salve a OS com data da visita e técnico — a agenda é criada automaticamente."
                  : "Visita ainda não na agenda. Peça para atualizar data/técnico na OS."}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {(agendamentos || []).map((a) => (
                  <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="font-medium text-slate-800">
                      {formatDate(a.data)} — {TIPO_AGENDAMENTO_LABEL[a.tipo] || a.tipo}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatHora(a.hora_inicio)}{a.hora_fim ? `–${formatHora(a.hora_fim)}` : ""}
                      {a.tecnico && ` • ${a.tecnico}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {STATUS_AGENDAMENTO_LABEL[a.status] || a.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Cliente ausente — técnico */}
          {podeRegistrarAusente && (
            <div className="card border-amber-200 p-5">
              <h3 className="mb-3 text-sm font-semibold text-amber-800">Cliente ausente</h3>
              <OsClienteAusente
                osId={id}
                assinaturaTecnico={os.assinatura_tecnico}
                action={clienteAusenteAction}
              />
            </div>
          )}

          {os.status === "cliente_ausente" && (
            <div className="card border-rose-200 bg-rose-50/50 p-5">
              <h3 className="mb-2 text-sm font-semibold text-rose-800">Registro — cliente ausente</h3>
              {os.cliente_ausente_registrado_at && (
                <p className="mb-2 text-xs text-slate-500">
                  Registrado em {formatDateTime(os.cliente_ausente_registrado_at)}
                </p>
              )}
              {os.observacao_cliente_ausente && (
                <p className="mb-2 text-sm text-slate-600">{os.observacao_cliente_ausente}</p>
              )}
              {os.assinatura_tecnico && (
                <div className="mb-3 rounded-lg border bg-white p-2">
                  <p className="mb-1 text-xs text-slate-500">Assinatura do técnico</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={os.assinatura_tecnico} alt="Assinatura técnico" className="h-16 object-contain" />
                </div>
              )}
              {(anexos || []).filter((a) => a.momento === "cliente_ausente").length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">Foto comprobatória</p>
                  <div className="flex flex-wrap gap-2">
                    {(anexos || [])
                      .filter((a) => a.momento === "cliente_ausente")
                      .map((a) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={a.id}
                          src={a.url}
                          alt="Cliente ausente"
                          className="h-24 w-24 rounded-lg border object-cover"
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Financeiro */}
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <DollarSign className="h-4 w-4" /> Financeiro
            </h3>
            {lancamentosAtivos.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {lancamentosAtivos.map((l) => {
                  const devido = valorDevido(l);
                  const saldo = saldoEmAberto(l);
                  const recebido = l.tipo === "receita" && l.status === "pago";
                  const parcial = l.tipo === "receita" && l.status === "parcial";
                  const label =
                    l.tipo === "despesa"
                      ? l.status === "pago"
                        ? "Pago"
                        : "A pagar"
                      : recebido
                        ? "Recebido"
                        : parcial
                          ? "Parcial"
                          : "A receber";
                  const valorExibir =
                    l.tipo === "receita" && (recebido || parcial)
                      ? Number(l.valor_pago || 0)
                      : devido;
                  return (
                  <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <div className="min-w-0">
                      <span className={l.tipo === "despesa" ? "text-red-600" : recebido ? "text-green-600" : "text-amber-600"}>
                        {l.tipo === "despesa" ? "Custo" : label}
                      </span>
                      <p className="truncate text-xs text-slate-400">{l.descricao}</p>
                      {parcial && saldo > 0 && (
                        <p className="text-xs text-amber-600">Saldo: {formatCurrency(saldo)}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-medium">
                        {l.tipo === "despesa" ? "- " : ""}{formatCurrency(valorExibir)}
                      </span>
                      {podeFinanceiro && (
                        <LancamentoAcoes
                          lancamento={l}
                          categorias={categorias || []}
                          editarAction={atualizarLancamento.bind(null, l.id)}
                          excluirAction={excluirLancamento.bind(null, l.id)}
                        />
                      )}
                    </div>
                  </li>
                  );
                })}
                {mostrarLucro && (
                  <>
                <li className="flex items-center justify-between border-t border-slate-200 px-3 pt-2 text-xs text-slate-500">
                  <span>Lucro bruto</span>
                  <span>{formatCurrency(lucroOs.lucroBruto)}</span>
                </li>
                {lucroOs.despesasOs > 0 && (
                  <li className="flex items-center justify-between px-3 text-xs text-slate-500">
                    <span>Despesas vinculadas</span>
                    <span>- {formatCurrency(lucroOs.despesasOs)}</span>
                  </li>
                )}
                <li className="flex items-center justify-between border-t border-slate-200 px-3 pt-2 font-semibold">
                  <span>Lucro líquido</span>
                  <span className={lucroOs.lucroLiquido >= 0 ? "text-green-700" : "text-red-600"}>
                    {formatCurrency(lucroOs.lucroLiquido)}
                  </span>
                </li>
                  </>
                )}
              </ul>
            ) : podeFinanceiro ? (
              <form action={financeiroAction} className="space-y-2">
                <select name="status_pagamento" className="input" defaultValue="pendente">
                  <option value="pendente">A receber (pendente)</option>
                  <option value="pago">Já recebido (pago)</option>
                </select>
                <input type="date" name="data_vencimento" className="input" />
                <p className="text-xs text-slate-500">
                  O custo de peças será lançado como despesa pendente (separado do recebimento).
                </p>
                <button className="btn-primary w-full">
                  Lançar receita {formatCurrency(valorTotal)}
                  {os.custo_total > 0 ? ` + custo pendente ${formatCurrency(os.custo_total)}` : ""}
                </button>
              </form>
            ) : (
              <p className="text-sm text-slate-500">Sem lançamento financeiro. Aprovação gera receita pendente automaticamente.</p>
            )}
          </div>

          {podeAbrirRetornoGarantiaBtn && fimGarantia && (
            <div className="card p-5">
              <AbrirRetornoGarantia
                osId={id}
                action={abrirRetornoGarantia}
                fimGarantiaLabel={fimGarantia.toLocaleDateString("pt-BR")}
              />
            </div>
          )}

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
            <p>
              <span className="font-medium">Visita:</span> {formatDate(os.data_previsao)}
              {os.turno ? ` • ${TURNO_LABEL[os.turno] || ""}` : ""}
            </p>
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

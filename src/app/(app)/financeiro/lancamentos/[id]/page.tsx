import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader } from "@/components/ui";
import { PagamentosLista } from "@/components/pagamentos-lista";
import { NovoPagamentoForm } from "@/components/novo-pagamento-form";
import { LancamentoAcoes } from "@/components/lancamento-acoes";
import { formatCurrency, formatDate, formatNumeroOS } from "@/lib/format";
import { saldoEmAberto, valorDevido } from "@/lib/financeiro";
import { COLUNAS_PAGAMENTO, type OsPagamentoRow } from "@/lib/os-pagamentos";
import { comPermissao } from "@/lib/pagamentos-permissao";
import { atualizarLancamento, excluirLancamento } from "../../actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Em aberto",
  parcial: "Parcial",
  pago: "Quitado",
  cancelado: "Cancelado",
};

export default async function LancamentoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requirePermissao("financeiro");
  const supabase = await createClient();

  const [{ data: l }, { data: pagamentos }, { data: contas }, { data: categorias }] = await Promise.all([
    supabase
      .from("lancamentos_financeiros")
      .select("*, categorias_financeiras(nome), clientes(nome), ordens_servico(numero)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("os_pagamentos")
      .select(COLUNAS_PAGAMENTO)
      .eq("lancamento_id", id)
      .order("data_pagamento")
      .order("created_at"),
    supabase.from("contas_financeiras").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("categorias_financeiras").select("*").order("nome"),
  ]);

  if (!l) notFound();

  // Comprovante (bucket privado): link temporário de 1 hora
  const comprovanteUrl = l.comprovante_path
    ? (await supabase.storage.from("comprovantes").createSignedUrl(l.comprovante_path, 3600)).data?.signedUrl ?? null
    : null;

  const rel = l as unknown as {
    categorias_financeiras?: { nome: string } | null;
    clientes?: { nome: string } | null;
    ordens_servico?: { numero: number } | null;
  };
  const devido = valorDevido(l);
  const saldo = saldoEmAberto(l);
  const lista = comPermissao(profile, (pagamentos || []) as OsPagamentoRow[], contas || []);
  const receita = l.tipo === "receita";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/financeiro" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Financeiro
      </Link>
      <PageHeader
        title={l.descricao}
        subtitle={`${receita ? "Conta a receber" : "Conta a pagar"} • ${STATUS_LABEL[l.status] ?? l.status}`}
        action={
          <>
            {receita && Number(l.valor_pago) > 0 && (
              <Link href={`/imprimir/recibo/${l.id}`} target="_blank" className="btn-secondary">
                <Receipt className="h-4 w-4" /> Recibo
              </Link>
            )}
            <LancamentoAcoes
              lancamento={l}
              categorias={categorias || []}
              editarAction={atualizarLancamento.bind(null, l.id)}
              excluirAction={excluirLancamento.bind(null, l.id)}
              compact={false}
            />
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Info rotulo="Valor devido" valor={formatCurrency(devido)} />
        <Info rotulo={receita ? "Recebido" : "Pago"} valor={formatCurrency(Number(l.valor_pago))} cor="text-green-700" />
        <Info rotulo="Em aberto" valor={formatCurrency(saldo)} cor={saldo > 0 ? "text-amber-700" : "text-slate-500"} />
        <Info
          rotulo="Crédito do cliente"
          valor={formatCurrency(Math.max(0, Number(l.valor_pago) - devido))}
          cor={Number(l.valor_pago) > devido + 0.004 ? "text-indigo-700" : "text-slate-400"}
        />
      </div>

      <div className="card mb-4 grid grid-cols-1 gap-2 p-4 text-sm sm:grid-cols-2">
        <p><span className="text-slate-500">Competência:</span> {formatDate(l.data_competencia)}</p>
        <p><span className="text-slate-500">Vencimento:</span> {l.data_vencimento ? formatDate(l.data_vencimento) : "-"}</p>
        <p><span className="text-slate-500">Categoria:</span> {rel.categorias_financeiras?.nome ?? "-"}</p>
        <p><span className="text-slate-500">Cliente:</span> {rel.clientes?.nome ?? "-"}</p>
        {l.os_id && (
          <p>
            <span className="text-slate-500">OS:</span>{" "}
            <Link href={`/ordens/${l.os_id}`} className="text-brand-700 hover:underline">
              {rel.ordens_servico ? formatNumeroOS(rel.ordens_servico.numero) : "Abrir OS"}
            </Link>
          </p>
        )}
        {Number(l.juros) + Number(l.multa) > 0 && (
          <p><span className="text-slate-500">Juros + multa:</span> {formatCurrency(Number(l.juros) + Number(l.multa))}</p>
        )}
        {l.km_veiculo != null && (
          <p><span className="text-slate-500">Km do veículo:</span> {l.km_veiculo.toLocaleString("pt-BR")}</p>
        )}
        {l.litros != null && (
          <p>
            <span className="text-slate-500">Litros:</span> {Number(l.litros).toLocaleString("pt-BR")} •{" "}
            {formatCurrency(Number(l.valor) / Number(l.litros))}/L
          </p>
        )}
        {l.origem === "campo" && l.tecnico && (
          <p><span className="text-slate-500">Lançado em campo por:</span> {l.tecnico}</p>
        )}
        {l.observacoes && <p className="sm:col-span-2 text-slate-600">{l.observacoes}</p>}
        {comprovanteUrl && (
          <a href={comprovanteUrl} target="_blank" rel="noopener noreferrer" className="sm:col-span-2 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={comprovanteUrl} alt="Comprovante" className="max-h-80 rounded-lg ring-1 ring-slate-200" />
            <span className="mt-1 block text-xs text-brand-700">Abrir comprovante</span>
          </a>
        )}
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-700">{receita ? "Recebimentos" : "Pagamentos"}</h3>
        {lista.length === 0 && <p className="mt-2 text-sm text-slate-500">Nenhum pagamento lançado ainda.</p>}
        <PagamentosLista
          pagamentos={lista}
          contas={contas || []}
          titulo={`${lista.length} lançamento(s) — a soma atualiza o título automaticamente`}
          tipoLancamento={l.tipo}
        />
        {l.status !== "cancelado" && saldo > 0 && (
          <NovoPagamentoForm
            lancamentoId={l.id}
            saldo={saldo}
            contas={contas || []}
            formaPadrao={l.forma_pagamento}
            ehOs={Boolean(l.os_id)}
            receita={receita}
          />
        )}
      </div>
    </div>
  );
}

function Info({ rotulo, valor, cor = "text-slate-900" }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
      <p className="text-[10px] font-medium uppercase text-slate-400">{rotulo}</p>
      <p className={`text-base font-bold ${cor}`}>{valor}</p>
    </div>
  );
}

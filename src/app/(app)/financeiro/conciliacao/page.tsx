import Link from "next/link";
import { ArrowLeft, FileText, Settings2, Trash2, Wand2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { ActionForm } from "@/components/use-action";
import { ConfirmButton } from "@/components/confirm-button";
import { ImportarExtrato } from "@/components/conciliacao/importar-extrato";
import { TransacaoLinha, type CandidatoView, type TransacaoView } from "@/components/conciliacao/transacao-linha";
import { formatCurrency, formatDate, formatDateTime, hojeYmdLocal } from "@/lib/format";
import { diasEntre, sugerirConciliacao } from "@/lib/conciliacao";
import { carregarPendencias } from "@/lib/conciliacao-dados";
import { saldoSistemaConta, periodoMes } from "@/lib/conciliacao-saldo";
import { conciliarAutomaticamente, excluirImportacao } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; mes?: string; status?: string }>;
}) {
  const sp = await searchParams;
  await requirePermissao("financeiro");
  const supabase = await createClient();

  const { data: contas } = await supabase
    .from("contas_financeiras")
    .select("*")
    .eq("ativo", true)
    .order("tipo")
    .order("nome");
  const listaContas = contas || [];
  const conta = listaContas.find((c) => c.id === sp.conta) ?? listaContas.find((c) => c.tipo === "banco") ?? listaContas[0];

  if (!conta) {
    return (
      <div>
        <PageHeader title="Conciliação bancária" subtitle="Cadastre uma conta para começar" />
        <EmptyState title="Nenhuma conta cadastrada" description="Cadastre o Bradesco, a InfinitePay e o caixa." />
        <Link href="/financeiro/contas" className="btn-primary mt-4">Cadastrar contas</Link>
      </div>
    );
  }

  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hojeYmdLocal().slice(0, 7);
  const { inicio, fim, label } = periodoMes(mes);
  const maquininha = conta.tipo === "maquininha";

  const [{ data: txRows }, { data: importacoes }, { data: categorias }, pend, saldoSistema] = await Promise.all([
    supabase
      .from("extrato_transacoes")
      .select("*")
      .eq("conta_id", conta.id)
      .gte("data", inicio)
      .lte("data", fim)
      .order("data")
      .order("created_at"),
    supabase
      .from("extrato_importacoes")
      .select("*")
      .eq("conta_id", conta.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("categorias_financeiras").select("id, nome, tipo").order("nome"),
    carregarPendencias(supabase, conta.id, inicio, fim),
    saldoSistemaConta(supabase, conta, fim),
  ]);

  const transacoes = txRows || [];
  const idsTx = transacoes.map((t) => t.id);
  const { data: vinc } = idsTx.length
    ? await supabase
        .from("os_pagamentos")
        .select("valor, data_pagamento, extrato_transacao_id, lancamento_id, lancamentos_financeiros(descricao)")
        .in("extrato_transacao_id", idsTx)
    : { data: [] };

  type VincRow = {
    valor: number;
    data_pagamento: string;
    extrato_transacao_id: string;
    lancamento_id: string | null;
    lancamentos_financeiros: { descricao: string } | null;
  };
  const vinculadosPorTx = new Map<string, TransacaoView["vinculados"]>();
  for (const v of (vinc || []) as unknown as VincRow[]) {
    const arr = vinculadosPorTx.get(v.extrato_transacao_id) ?? [];
    arr.push({
      descricao: v.lancamentos_financeiros?.descricao ?? "Pagamento",
      valor: Number(v.valor),
      data: v.data_pagamento,
      lancamentoId: v.lancamento_id,
    });
    vinculadosPorTx.set(v.extrato_transacao_id, arr);
  }

  const filtro = sp.status === "pendente" || sp.status === "conciliado" || sp.status === "ignorado" ? sp.status : null;
  const visiveis = filtro ? transacoes.filter((t) => t.status === filtro) : transacoes;

  const entradas = transacoes.filter((t) => Number(t.valor) > 0).reduce((s, t) => s + Number(t.valor), 0);
  const saidas = transacoes.filter((t) => Number(t.valor) < 0).reduce((s, t) => s + Number(t.valor), 0);
  const qtdPend = transacoes.filter((t) => t.status === "pendente").length;
  const qtdOk = transacoes.length - qtdPend;
  const pct = transacoes.length ? Math.round((qtdOk / transacoes.length) * 100) : 0;

  const saldoExtrato =
    (importacoes || []).find((i) => i.saldo_final != null && i.periodo_fim && i.periodo_fim >= inicio && i.periodo_fim <= fim)
      ?.saldo_final ?? null;

  // Pagamentos lançados nesta conta no mês que ainda não apareceram no extrato
  const semExtrato = pend.pagamentos
    .filter((p) => p.contaId === conta.id && p.data >= inicio && p.data <= fim)
    .sort((a, b) => a.data.localeCompare(b.data));

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ conta: conta.id, mes, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v)) as Record<string, string> });
    return `/financeiro/conciliacao?${p.toString()}`;
  };

  return (
    <div>
      <Link href="/financeiro" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Financeiro
      </Link>
      <PageHeader
        title="Conciliação bancária"
        subtitle={`${conta.nome} — ${label}`}
        action={
          <>
            <Link href={`/imprimir/conciliacao?conta=${conta.id}&mes=${mes}`} target="_blank" className="btn-secondary">
              <FileText className="h-4 w-4" /> Relatório do contador
            </Link>
            <Link href="/financeiro/contas" className="btn-secondary">
              <Settings2 className="h-4 w-4" /> Contas
            </Link>
            <ImportarExtrato contas={listaContas.map((c) => ({ id: c.id, nome: c.nome }))} contaPadrao={conta.id} />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {listaContas.map((c) => (
          <Link
            key={c.id}
            href={`/financeiro/conciliacao?conta=${c.id}&mes=${mes}`}
            className={`badge px-3 py-1.5 text-sm ${c.id === conta.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            {c.nome}
          </Link>
        ))}
        <form action="/financeiro/conciliacao" method="get" className="ml-auto flex items-center gap-2">
          <input type="hidden" name="conta" value={conta.id} />
          <input type="month" name="mes" defaultValue={mes} className="input max-w-[170px]" />
          <button className="btn-secondary">Ver mês</button>
        </form>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard title="Entradas no extrato" value={formatCurrency(entradas)} tone="green" />
        <StatCard title="Saídas no extrato" value={formatCurrency(Math.abs(saidas))} tone="red" />
        <StatCard title="Conciliado" value={`${pct}%`} hint={`${qtdOk} de ${transacoes.length} linha(s) • ${qtdPend} pendente(s)`} />
        <StatCard
          title="Saldo sistema × banco"
          value={formatCurrency(saldoSistema)}
          hint={
            saldoExtrato == null
              ? "Importe o OFX para comparar com o saldo do banco"
              : Math.abs(saldoExtrato - saldoSistema) < 0.01
                ? `Banco ${formatCurrency(saldoExtrato)} — bate ✔`
                : `Banco ${formatCurrency(saldoExtrato)} — diferença ${formatCurrency(saldoExtrato - saldoSistema)}`
          }
          tone={saldoExtrato != null && Math.abs(saldoExtrato - saldoSistema) >= 0.01 ? "red" : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5 text-xs">
              {[
                ["", "Todas"],
                ["pendente", "Pendentes"],
                ["conciliado", "Conciliadas"],
                ["ignorado", "Ignoradas"],
              ].map(([v, l]) => (
                <Link
                  key={v}
                  href={qs({ status: v || undefined })}
                  className={`badge ${(filtro ?? "") === v ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {l}
                </Link>
              ))}
            </div>
            {qtdPend > 0 && (
              <ActionForm action={conciliarAutomaticamente} successMsg="Conciliação automática concluída.">
                <input type="hidden" name="conta_id" value={conta.id} />
                <input type="hidden" name="inicio" value={inicio} />
                <input type="hidden" name="fim" value={fim} />
                <button className="btn-secondary py-1 text-xs" title="Concilia só os casos sem dúvida: mesmo valor, até 3 dias, sem outro candidato">
                  <Wand2 className="h-3.5 w-3.5" /> Conciliar automaticamente
                </button>
              </ActionForm>
            )}
          </div>

          {visiveis.length === 0 ? (
            <EmptyState
              title={transacoes.length ? "Nada neste filtro" : "Nenhum extrato importado neste mês"}
              description={transacoes.length ? "" : "Clique em “Importar extrato” e envie o OFX, CSV ou PDF do banco."}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visiveis.map((t) => {
                const tx = { id: t.id, data: t.data, valor: Number(t.valor), contaId: t.conta_id };
                let candidatos: CandidatoView[] = [];
                let sugestoes: ReturnType<typeof sugerirConciliacao> = [];
                if (t.status === "pendente") {
                  sugestoes = sugerirConciliacao(tx, pend.pagamentos, { maquininha, limite: 3 });
                  candidatos = pend.pagamentos
                    .filter((p) => (tx.valor > 0 ? p.tipoLancamento === "receita" : p.tipoLancamento === "despesa"))
                    .filter((p) => {
                      const d = diasEntre(p.data, tx.data);
                      return d >= -5 && d <= (maquininha ? 35 : 15);
                    })
                    .sort((a, b) => Math.abs(a.valor - Math.abs(tx.valor)) - Math.abs(b.valor - Math.abs(tx.valor)))
                    .slice(0, 40)
                    .map((p) => ({ id: p.id, valor: p.valor, data: p.data, descricao: p.descricao, forma: p.forma }));
                  // garante que os ids das sugestões estejam na lista para exibir os nomes
                  const ids = new Set(candidatos.map((c) => c.id));
                  for (const s of sugestoes) {
                    for (const id of s.pagamentoIds) {
                      if (ids.has(id)) continue;
                      const p = pend.pagamentos.find((x) => x.id === id);
                      if (p) candidatos.push({ id: p.id, valor: p.valor, data: p.data, descricao: p.descricao, forma: p.forma });
                    }
                  }
                }
                return (
                  <TransacaoLinha
                    key={t.id}
                    tx={{
                      id: t.id,
                      data: t.data,
                      valor: Number(t.valor),
                      descricao: t.descricao,
                      documento: t.documento,
                      status: t.status,
                      observacao: t.observacao,
                      vinculados: vinculadosPorTx.get(t.id) ?? [],
                      taxaAjuste: Number(t.taxa_ajuste || 0),
                    }}
                    sugestoes={sugestoes.map((s) => ({ pagamentoIds: s.pagamentoIds, soma: s.soma, diferenca: s.diferenca, motivo: s.motivo }))}
                    candidatos={candidatos}
                    categorias={categorias || []}
                    maquininha={maquininha}
                  />
                );
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-1 text-sm font-semibold text-slate-700">No sistema, sem extrato</h3>
            <p className="mb-2 text-xs text-slate-500">
              Pagamentos lançados em {conta.nome} neste mês que ainda não foram encontrados no banco.
            </p>
            {semExtrato.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {semExtrato.slice(0, 30).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {formatDate(p.data)} • {p.descricao}
                    </span>
                    <strong className={p.tipoLancamento === "receita" ? "text-green-700" : "text-red-700"}>
                      {formatCurrency(p.tipoLancamento === "receita" ? p.valor : -p.valor)}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">Importações recentes</h3>
            {(importacoes || []).length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {(importacoes || []).map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-700">{i.arquivo_nome ?? i.formato.toUpperCase()}</p>
                      <p className="text-slate-500">
                        {formatDateTime(i.created_at)} • {i.qtd_transacoes} linha(s)
                        {i.qtd_duplicadas ? ` • ${i.qtd_duplicadas} repetida(s)` : ""}
                      </p>
                    </div>
                    <ConfirmButton
                      action={excluirImportacao.bind(null, i.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Excluir importação"
                      message="Excluir esta importação e suas linhas pendentes? (Só é possível se nenhuma linha estiver conciliada.)"
                      confirmLabel="Excluir"
                      successMsg="Importação excluída."
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </ConfirmButton>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

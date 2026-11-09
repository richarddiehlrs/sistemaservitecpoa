import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PrintButton } from "@/components/print-button";
import { ExportCsv } from "@/components/export-csv";
import { getConfig } from "@/lib/config";
import { formatCurrency, formatDate, formatDateTime, hojeYmdLocal } from "@/lib/format";
import { periodoMes, saldoSistemaConta } from "@/lib/conciliacao-saldo";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pendente: "Pendente", conciliado: "Conciliado", ignorado: "Ignorado" };

/** Relatório mensal de conciliação para o contador (imprimir / salvar PDF / CSV). */
export default async function RelatorioConciliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ conta?: string; mes?: string }>;
}) {
  const sp = await searchParams;
  await requirePermissao("financeiro");
  const supabase = await createClient();
  const config = await getConfig();

  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hojeYmdLocal().slice(0, 7);
  const { inicio, fim, label } = periodoMes(mes);

  const { data: conta } = await supabase.from("contas_financeiras").select("*").eq("id", sp.conta ?? "").maybeSingle();
  if (!conta) {
    return <p className="p-8">Conta não encontrada. Volte e escolha a conta na tela de conciliação.</p>;
  }

  const diaAnterior = new Date(Date.UTC(Number(inicio.slice(0, 4)), Number(inicio.slice(5, 7)) - 1, 0))
    .toISOString()
    .slice(0, 10);

  const [{ data: txs }, { data: pagamentosMes }, saldoIniSistema, saldoFimSistema, { data: imps }] = await Promise.all([
    supabase.from("extrato_transacoes").select("*").eq("conta_id", conta.id).gte("data", inicio).lte("data", fim).order("data").order("created_at"),
    supabase
      .from("os_pagamentos")
      .select("id, valor, taxa, data_pagamento, forma_pagamento, extrato_transacao_id, lancamentos_financeiros!inner(tipo, descricao, categorias_financeiras(nome))")
      .eq("conta_id", conta.id)
      .gte("data_pagamento", inicio)
      .lte("data_pagamento", fim)
      .order("data_pagamento"),
    saldoSistemaConta(supabase, conta, diaAnterior),
    saldoSistemaConta(supabase, conta, fim),
    supabase
      .from("extrato_importacoes")
      .select("saldo_final, periodo_fim")
      .eq("conta_id", conta.id)
      .not("saldo_final", "is", null)
      .gte("periodo_fim", inicio)
      .lte("periodo_fim", fim)
      .order("periodo_fim", { ascending: false })
      .limit(1),
  ]);

  type PagRow = {
    id: string;
    valor: number;
    taxa: number;
    data_pagamento: string;
    forma_pagamento: string | null;
    extrato_transacao_id: string | null;
    lancamentos_financeiros: { tipo: "receita" | "despesa"; descricao: string; categorias_financeiras: { nome: string } | null } | null;
  };
  const pags = (pagamentosMes || []) as unknown as PagRow[];
  const porTx = new Map<string, PagRow[]>();
  for (const p of pags) {
    if (!p.extrato_transacao_id) continue;
    porTx.set(p.extrato_transacao_id, [...(porTx.get(p.extrato_transacao_id) ?? []), p]);
  }
  // Pagamentos conciliados com transações de OUTRO mês também precisam do nome
  const idsTx = (txs || []).map((t) => t.id);
  if (idsTx.length) {
    const { data: extras } = await supabase
      .from("os_pagamentos")
      .select("id, valor, taxa, data_pagamento, forma_pagamento, extrato_transacao_id, lancamentos_financeiros!inner(tipo, descricao, categorias_financeiras(nome))")
      .in("extrato_transacao_id", idsTx);
    for (const p of (extras || []) as unknown as PagRow[]) {
      const arr = porTx.get(p.extrato_transacao_id!) ?? [];
      if (!arr.some((x) => x.id === p.id)) porTx.set(p.extrato_transacao_id!, [...arr, p]);
    }
  }

  const lista = txs || [];
  const entradas = lista.filter((t) => Number(t.valor) > 0).reduce((s, t) => s + Number(t.valor), 0);
  const saidas = lista.filter((t) => Number(t.valor) < 0).reduce((s, t) => s + Number(t.valor), 0);
  const pendentes = lista.filter((t) => t.status === "pendente");
  const semExtrato = pags.filter((p) => !p.extrato_transacao_id);
  const taxas = pags.reduce((s, p) => s + Number(p.taxa || 0), 0);
  const saldoBanco = imps?.[0]?.saldo_final != null ? Number(imps[0].saldo_final) : null;
  const diferenca = saldoBanco == null ? null : Math.round((saldoBanco - saldoFimSistema) * 100) / 100;

  const csvRows = lista.map((t) => {
    const vinc = porTx.get(t.id) ?? [];
    return [
      formatDate(t.data),
      t.descricao,
      t.documento ?? "",
      Number(t.valor).toFixed(2).replace(".", ","),
      STATUS[t.status],
      vinc.map((v) => v.lancamentos_financeiros?.descricao).join(" + "),
      vinc.map((v) => v.lancamentos_financeiros?.categorias_financeiras?.nome ?? "").filter(Boolean).join(" + "),
      Number(t.taxa_ajuste || 0).toFixed(2).replace(".", ","),
      t.observacao ?? "",
    ];
  });

  return (
    <>
      <PrintButton />
      <div className="no-print fixed right-4 top-16 z-50">
        <ExportCsv
          filename={`conciliacao-${conta.nome.replace(/\W+/g, "-").toLowerCase()}-${mes}.csv`}
          headers={["Data", "Descrição no banco", "Documento", "Valor", "Situação", "Lançamento no sistema", "Categoria", "Taxa", "Observação"]}
          rows={csvRows}
        />
      </div>
      <div className="folha-a4 mx-auto bg-white p-8 text-[11px] leading-snug text-slate-800">
        <header className="mb-4 border-b border-slate-300 pb-3">
          <h1 className="text-base font-bold">{config.nome}</h1>
          {config.cnpj && <p>CNPJ {config.cnpj}</p>}
          <h2 className="mt-2 text-sm font-semibold">
            Conciliação bancária — {conta.nome} — {label}
          </h2>
          <p className="text-slate-500">
            {conta.banco ? `Banco ${conta.banco}` : ""}
            {conta.agencia ? ` • Ag. ${conta.agencia}` : ""}
            {conta.numero ? ` • Conta ${conta.numero}` : ""} • Período {formatDate(inicio)} a {formatDate(fim)} • Emitido em{" "}
            {formatDateTime(new Date().toISOString())}
          </p>
        </header>

        <section className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1">
          <Linha rotulo="Saldo inicial (sistema)" valor={saldoIniSistema} />
          <Linha rotulo="Entradas no extrato" valor={entradas} />
          <Linha rotulo="Saídas no extrato" valor={saidas} />
          <Linha rotulo="Taxas retidas (maquininha)" valor={-taxas} />
          <Linha rotulo="Saldo final (sistema)" valor={saldoFimSistema} forte />
          <Linha rotulo="Saldo final (extrato do banco)" valor={saldoBanco} forte />
          <Linha rotulo="Diferença banco − sistema" valor={diferenca} forte alerta={diferenca != null && Math.abs(diferenca) >= 0.01} />
          <p className="col-span-2 mt-1 text-slate-600">
            {lista.length} linha(s) no extrato • {lista.length - pendentes.length} conciliada(s)/justificada(s) •{" "}
            <strong className={pendentes.length ? "text-red-700" : ""}>{pendentes.length} pendente(s)</strong> • {semExtrato.length} pagamento(s) no
            sistema sem correspondência no extrato
          </p>
        </section>

        <h3 className="mb-1 font-semibold">Movimentação do extrato</h3>
        <table className="mb-4 w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-400 text-left">
              <th className="py-1">Data</th>
              <th>Descrição no banco</th>
              <th>Lançamento no sistema</th>
              <th className="text-right">Valor</th>
              <th className="pl-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((t) => {
              const vinc = porTx.get(t.id) ?? [];
              return (
                <tr key={t.id} className="border-b border-slate-200 align-top">
                  <td className="whitespace-nowrap py-0.5">{formatDate(t.data)}</td>
                  <td>{t.descricao}</td>
                  <td>
                    {vinc.map((v) => v.lancamentos_financeiros?.descricao).join(" + ") || (t.status === "ignorado" ? t.observacao : "—")}
                    {Number(t.taxa_ajuste) > 0 && <span className="text-slate-500"> (taxa {formatCurrency(Number(t.taxa_ajuste))})</span>}
                  </td>
                  <td className={`whitespace-nowrap text-right ${Number(t.valor) < 0 ? "text-red-700" : ""}`}>{formatCurrency(Number(t.valor))}</td>
                  <td className={`pl-2 ${t.status === "pendente" ? "font-semibold text-red-700" : ""}`}>{STATUS[t.status]}</td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-slate-500">Nenhum extrato importado para este mês.</td>
              </tr>
            )}
          </tbody>
        </table>

        {semExtrato.length > 0 && (
          <>
            <h3 className="mb-1 font-semibold">Lançado no sistema, sem correspondência no extrato</h3>
            <table className="mb-4 w-full border-collapse">
              <tbody>
                {semExtrato.map((p) => (
                  <tr key={p.id} className="border-b border-slate-200">
                    <td className="whitespace-nowrap py-0.5">{formatDate(p.data_pagamento)}</td>
                    <td>{p.lancamentos_financeiros?.descricao}</td>
                    <td>{p.forma_pagamento ?? ""}</td>
                    <td className="whitespace-nowrap text-right">
                      {formatCurrency(p.lancamentos_financeiros?.tipo === "despesa" ? -Number(p.valor) : Number(p.valor))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <footer className="mt-8 grid grid-cols-2 gap-8 text-center text-slate-600">
          <div className="border-t border-slate-400 pt-1">Responsável financeiro</div>
          <div className="border-t border-slate-400 pt-1">Contador</div>
        </footer>
      </div>
    </>
  );
}

function Linha({ rotulo, valor, forte, alerta }: { rotulo: string; valor: number | null; forte?: boolean; alerta?: boolean }) {
  return (
    <p className={`flex justify-between ${forte ? "font-semibold" : ""} ${alerta ? "text-red-700" : ""}`}>
      <span>{rotulo}</span>
      <span>{valor == null ? "—" : formatCurrency(valor)}</span>
    </p>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DespesaCampoApp } from "@/components/despesa-campo-app";
import { ExcluirDespesaCampo } from "@/components/excluir-despesa-campo";
import { InstalarIphone } from "@/components/instalar-iphone";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";
import { formatCurrency, formatDate, formatNumeroOS, hojeYmdLocal } from "@/lib/format";

/** Bloco de despesas pelo celular para o administrador (dono que também atende). */
export async function MinhasDespesasCampo({ profileId }: { profileId: string }) {
  const supabase = await createClient();
  const hoje = hojeYmdLocal();

  const [{ data: despesas }, { data: contas }, { data: osAbertas }] = await Promise.all([
    supabase
      .from("lancamentos_financeiros")
      .select("id, descricao, valor, status, data_competencia, created_at, comprovante_path, forma_pagamento")
      .eq("origem", "campo")
      .eq("criado_por", profileId)
      .neq("status", "cancelado")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("contas_financeiras").select("id, nome, tipo, formas_padrao").eq("ativo", true).order("nome"),
    supabase
      .from("ordens_servico")
      .select("id, numero, clientes(nome)")
      .in("status", [...STATUS_OS_ABERTAS])
      .order("data_abertura", { ascending: false })
      .limit(40),
  ]);

  const osOpcoes = (osAbertas || []).map((o) => ({
    id: o.id,
    label: `${formatNumeroOS(o.numero)} — ${(o as unknown as { clientes?: { nome?: string } }).clientes?.nome ?? ""}`,
  }));
  const totalMes = (despesas || [])
    .filter((d) => d.data_competencia?.startsWith(hoje.slice(0, 7)))
    .reduce((s, d) => s + Number(d.valor), 0);

  return (
    <div className="mb-6 space-y-3">
      <InstalarIphone />
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold text-slate-900">Minhas despesas de campo</h2>
            <p className="text-xs text-slate-500">
              Combustível, peças e outros gastos — entram pagos no financeiro.{" "}
              <Link href="/financeiro/despesas-campo" className="text-brand-700 hover:underline">
                Relatório
              </Link>
            </p>
          </div>
          <DespesaCampoApp osOpcoes={osOpcoes} contas={contas || []} />
        </div>
        {!despesas || despesas.length === 0 ? (
          <p className="py-3 text-center text-sm text-slate-400">Nenhuma despesa lançada ainda.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {despesas.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                <Link href={`/financeiro/lancamentos/${d.id}`} className="min-w-0">
                  <p className="truncate font-medium text-slate-800">{d.descricao}</p>
                  <p className="text-xs text-slate-400">
                    {formatDate(d.data_competencia)}
                    {d.forma_pagamento ? ` • ${d.forma_pagamento}` : ""}
                    {d.comprovante_path ? " • com comprovante" : ""}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-semibold text-red-600">{formatCurrency(Number(d.valor))}</span>
                  {d.created_at && d.created_at.slice(0, 10) >= hoje && <ExcluirDespesaCampo id={d.id} />}
                </div>
              </li>
            ))}
          </ul>
        )}
        {totalMes > 0 && (
          <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
            Total no mês (últimos lançamentos): <strong>{formatCurrency(totalMes)}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

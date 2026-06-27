import Link from "next/link";
import { ArrowLeft, RefreshCw, X, Power } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, EmptyState } from "@/components/ui";
import { RecorrenteForm } from "@/components/recorrente-form";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionForm } from "@/components/use-action";
import { formatCurrency } from "@/lib/format";
import { salvarRecorrente, alternarRecorrente, excluirRecorrente, gerarDespesasDoMes } from "../actions";

export const dynamic = "force-dynamic";

export default async function RecorrentesPage() {
  await requirePermissao("financeiro_recorrentes");
  const supabase = await createClient();
  const [{ data: recorrentes }, { data: categorias }] = await Promise.all([
    supabase.from("despesas_recorrentes").select("*, categorias_financeiras(nome)").order("descricao"),
    supabase.from("categorias_financeiras").select("*").order("nome"),
  ]);

  const lista = recorrentes || [];
  const totalMensal = lista.filter((r) => r.ativo).reduce((s, r) => s + Number(r.valor), 0);
  const mesAtual = new Date().toISOString().slice(0, 7);

  return (
    <div>
      <PageHeader
        title="Despesas fixas recorrentes"
        subtitle={`Total fixo mensal: ${formatCurrency(totalMensal)}`}
        action={
          <>
            <Link href="/financeiro" className="btn-secondary">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <ActionForm action={gerarDespesasDoMes} successMsg="Despesas do mês geradas.">
              <input type="hidden" name="mes" value={mesAtual} />
              <button className="btn-secondary" title="Lançar estas despesas no mês atual">
                <RefreshCw className="h-4 w-4" /> Gerar mês atual
              </button>
            </ActionForm>
            <RecorrenteForm categorias={categorias || []} action={salvarRecorrente} />
          </>
        }
      />

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhuma despesa fixa cadastrada"
          description="Cadastre aluguel, combustível, ferramentas e outras despesas que se repetem todo mês."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th className="text-center">Vence dia</th>
                <th className="text-right">Valor</th>
                <th className="text-center">Status</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r) => (
                <tr key={r.id} className={!r.ativo ? "opacity-50" : ""}>
                  <td className="font-medium">{r.descricao}</td>
                  {/* @ts-expect-error relação */}
                  <td>{r.categorias_financeiras?.nome || "-"}</td>
                  <td className="text-center">{r.dia_vencimento}</td>
                  <td className="text-right font-semibold text-red-600">{formatCurrency(r.valor)}</td>
                  <td className="text-center">
                    <span className={`badge ${r.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {r.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <RecorrenteForm categorias={categorias || []} action={salvarRecorrente} recorrente={r} trigger="edit" />
                      <ActionForm
                        action={alternarRecorrente.bind(null, r.id, !r.ativo)}
                        successMsg={r.ativo ? "Despesa desativada." : "Despesa ativada."}
                      >
                        <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title={r.ativo ? "Desativar" : "Ativar"}>
                          <Power className="h-4 w-4" />
                        </button>
                      </ActionForm>
                      <ConfirmButton
                        action={excluirRecorrente.bind(null, r.id)}
                        className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Excluir despesa fixa"
                        message="Excluir esta despesa recorrente? Os lançamentos já gerados não são afetados."
                        confirmLabel="Excluir"
                      >
                        <X className="h-4 w-4" />
                      </ConfirmButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

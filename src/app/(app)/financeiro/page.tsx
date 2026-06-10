import Link from "next/link";
import { TrendingUp, TrendingDown, Wallet, Clock, Receipt, CalendarCog, LineChart, RefreshCw, X, Ban } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getConfig } from "@/lib/config";
import { requirePermissao } from "@/lib/auth-guard";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { LancamentoForm } from "@/components/lancamento-form";
import { RegistrarPagamento } from "@/components/registrar-pagamento";
import { CobrancaWhatsApp } from "@/components/cobranca-whatsapp";
import { ConfirmButton } from "@/components/confirm-button";
import { LancamentoAcoes } from "@/components/lancamento-acoes";
import { formatCurrency, formatDate } from "@/lib/format";
import { saldoEmAberto, valorDevido } from "@/lib/financeiro";
import {
  criarLancamento,
  registrarPagamento,
  atualizarLancamento,
  cancelarLancamento,
  excluirLancamento,
  gerarDespesasDoMes,
} from "./actions";

export const dynamic = "force-dynamic";

function inicioFimMes(mesStr?: string) {
  const base = mesStr ? new Date(mesStr + "-01T00:00:00") : new Date();
  const inicio = new Date(base.getFullYear(), base.getMonth(), 1);
  const fim = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fim: fim.toISOString().slice(0, 10),
    label: base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    value: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`,
  };
}

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; tipo?: string; status?: string; vencidos?: string }>;
}) {
  const { mes, tipo, status, vencidos } = await searchParams;
  await requirePermissao("financeiro");
  const periodo = inicioFimMes(mes);
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("lancamentos_financeiros")
    .select("*, categorias_financeiras(nome), clientes(nome, telefone)")
    .gte("data_competencia", periodo.inicio)
    .lte("data_competencia", periodo.fim)
    .order("data_vencimento", { ascending: true });

  if (tipo) query = query.eq("tipo", tipo);
  if (status) query = query.eq("status", status);

  const [{ data: lancamentos }, { data: categorias }, config] = await Promise.all([
    query,
    supabase.from("categorias_financeiras").select("*").order("nome"),
    getConfig(),
  ]);

  const lista = lancamentos || [];
  const ativos = lista.filter((l) => l.status !== "cancelado");
  const receitas = ativos.filter((l) => l.tipo === "receita");
  const despesas = ativos.filter((l) => l.tipo === "despesa");

  const recebido = receitas.reduce((s, l) => s + Number(l.valor_pago), 0);
  const pago = despesas.reduce((s, l) => s + Number(l.valor_pago), 0);
  const aReceber = receitas.filter((l) => l.status !== "pago").reduce((s, l) => s + saldoEmAberto(l), 0);
  const aPagar = despesas.filter((l) => l.status !== "pago").reduce((s, l) => s + saldoEmAberto(l), 0);
  const saldo = recebido - pago;

  const inadimplentes = receitas
    .filter((l) => l.status !== "pago" && l.data_vencimento && l.data_vencimento < hoje)
    .map((l) => ({ ...l, saldo: saldoEmAberto(l) }))
    .filter((l) => l.saldo > 0);
  const totalInadimplencia = inadimplentes.reduce((s, l) => s + l.saldo, 0);

  const listaFiltrada = vencidos === "1"
    ? lista.filter((l) => l.status !== "pago" && l.status !== "cancelado" && l.data_vencimento && l.data_vencimento < hoje)
    : lista;

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle={`Contas a receber e a pagar — ${periodo.label}`}
        action={
          <>
            <Link href="/financeiro/fluxo" className="btn-secondary">
              <LineChart className="h-4 w-4" /> Fluxo de caixa
            </Link>
            <Link href="/financeiro/recorrentes" className="btn-secondary">
              <CalendarCog className="h-4 w-4" /> Despesas fixas
            </Link>
            <LancamentoForm categorias={categorias || []} action={criarLancamento} />
          </>
        }
      />

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form className="flex flex-wrap items-center gap-2" action="/financeiro" method="get">
          <input type="month" name="mes" defaultValue={periodo.value} className="input max-w-[180px]" />
          <select name="tipo" defaultValue={tipo || ""} className="input max-w-[160px]">
            <option value="">Todos os tipos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
          </select>
          <select name="status" defaultValue={status || ""} className="input max-w-[160px]">
            <option value="">Todas situações</option>
            <option value="pendente">Pendentes</option>
            <option value="parcial">Parciais</option>
            <option value="pago">Quitados</option>
            <option value="cancelado">Cancelados</option>
          </select>
          <button className="btn-secondary">Filtrar</button>
        </form>
        <form action={gerarDespesasDoMes}>
          <input type="hidden" name="mes" value={periodo.value} />
          <button className="btn-secondary" title="Lança as despesas fixas cadastradas para este mês">
            <RefreshCw className="h-4 w-4" /> Gerar despesas fixas
          </button>
        </form>
        <Link
          href={`/financeiro?mes=${periodo.value}&vencidos=1`}
          className={`badge ${vencidos === "1" ? "bg-red-600 text-white" : "bg-white text-red-600 ring-1 ring-red-200"}`}
        >
          Vencidos ({inadimplentes.length})
        </Link>
      </div>

      {inadimplentes.length > 0 && (
        <div className="mb-4 card border-red-200 bg-red-50/50 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-red-800">Inadimplência — contas a receber vencidas</h3>
              <p className="text-sm text-red-600">{inadimplentes.length} título(s) • Total em aberto: {formatCurrency(totalInadimplencia)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {inadimplentes.slice(0, 5).map((l) => {
              // @ts-expect-error relação
              const cli = l.clientes;
              return (
                <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{l.descricao}</span>
                    {cli?.nome && <span className="ml-2 text-slate-500">{cli.nome}</span>}
                    <span className="ml-2 text-xs text-red-500">venceu {formatDate(l.data_vencimento)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-red-700">{formatCurrency(l.saldo)}</span>
                    <CobrancaWhatsApp
                      telefone={cli?.telefone}
                      cliente={cli?.nome}
                      descricao={l.descricao}
                      valor={l.saldo}
                      vencimento={l.data_vencimento}
                      empresa={config.nome}
                    />
                  </div>
                </div>
              );
            })}
            {inadimplentes.length > 5 && (
              <Link href={`/financeiro?mes=${periodo.value}&vencidos=1`} className="text-xs font-medium text-red-600 hover:underline">
                Ver todos os {inadimplentes.length} vencidos →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Recebido" value={formatCurrency(recebido)} tone="green" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Pago" value={formatCurrency(pago)} tone="red" icon={<TrendingDown className="h-5 w-5" />} />
        <StatCard title="Saldo (caixa)" value={formatCurrency(saldo)} tone={saldo >= 0 ? "blue" : "red"} icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="A receber" value={formatCurrency(aReceber)} tone="amber" icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="A pagar" value={formatCurrency(aPagar)} tone="amber" icon={<Clock className="h-5 w-5" />} />
      </div>

      <div className="mt-6 card overflow-x-auto">
        {listaFiltrada.length === 0 ? (
          <EmptyState title="Nenhum lançamento no período" description="Adicione receitas e despesas para acompanhar o caixa." />
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Vencimento</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Situação</th>
                <th className="text-right">Valor</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((l) => {
                const vencido = l.status !== "pago" && l.status !== "cancelado" && l.data_vencimento && l.data_vencimento < hoje;
                const saldoAberto = saldoEmAberto(l);
                // @ts-expect-error relação
                const cli = l.clientes;
                return (
                  <tr key={l.id} className={l.status === "cancelado" ? "opacity-50" : ""}>
                    <td className={vencido ? "font-medium text-red-600" : ""}>
                      {l.data_vencimento ? formatDate(l.data_vencimento) : "-"}
                      {vencido && <span className="block text-[10px] font-semibold uppercase">Vencido</span>}
                    </td>
                    <td className="font-medium">
                      {l.descricao}
                      {l.origem === "campo" && (
                        <span className="ml-1 inline-block rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                          Campo{l.tecnico ? ` • ${l.tecnico}` : ""}
                        </span>
                      )}
                      {cli?.nome && <span className="block text-xs text-slate-400">{cli.nome}</span>}
                    </td>
                    {/* @ts-expect-error relação */}
                    <td>{l.categorias_financeiras?.nome || "-"}</td>
                    <td>
                      <span className={`badge ${
                        l.status === "pago" ? "bg-green-100 text-green-700"
                        : l.status === "parcial" ? "bg-indigo-100 text-indigo-700"
                        : l.status === "cancelado" ? "bg-slate-100 text-slate-500"
                        : vencido ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                      }`}>
                        {l.status === "pago" ? "Quitado"
                          : l.status === "parcial" ? "Parcial"
                          : l.status === "cancelado" ? "Cancelado"
                          : vencido ? "Vencido" : "Pendente"}
                      </span>
                    </td>
                    <td className={`text-right font-semibold ${l.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>
                      {l.tipo === "receita" ? "+" : "-"} {formatCurrency(valorDevido(l))}
                      {l.valor_liquido != null && l.tipo === "receita" && Number(l.taxa_cartao) > 0 && (
                        <span className="block text-[11px] font-normal text-slate-400">
                          líquido {formatCurrency(l.valor_liquido)}
                        </span>
                      )}
                      {l.status === "parcial" && (
                        <span className="block text-[11px] font-normal text-slate-400">
                          pago {formatCurrency(l.valor_pago)} • resta {formatCurrency(saldoAberto)}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {l.status !== "pago" && l.status !== "cancelado" && (
                          <RegistrarPagamento
                            lancamento={{ id: l.id, descricao: l.descricao, valor: l.valor, valor_pago: l.valor_pago, juros: l.juros, multa: l.multa }}
                            action={registrarPagamento.bind(null, l.id)}
                          />
                        )}
                        {l.tipo === "receita" && vencido && (
                          <CobrancaWhatsApp
                            telefone={cli?.telefone}
                            cliente={cli?.nome}
                            descricao={l.descricao}
                            valor={saldoAberto}
                            vencimento={l.data_vencimento}
                            empresa={config.nome}
                          />
                        )}
                        {l.tipo === "receita" && Number(l.valor_pago) > 0 && (
                          <Link href={`/imprimir/recibo/${l.id}`} target="_blank" className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Recibo / comprovante">
                            <Receipt className="h-4 w-4" />
                          </Link>
                        )}
                        <LancamentoAcoes
                          lancamento={l}
                          categorias={categorias || []}
                          editarAction={atualizarLancamento.bind(null, l.id)}
                          excluirAction={excluirLancamento.bind(null, l.id)}
                        />
                        {l.status !== "cancelado" && (
                          <ConfirmButton
                            action={cancelarLancamento.bind(null, l.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-700"
                            title="Cancelar lançamento"
                            message="Deseja cancelar este lançamento? Ele ficará marcado como cancelado (não entra nos totais)."
                            confirmLabel="Cancelar"
                            successMsg="Lançamento cancelado."
                          >
                            <Ban className="h-4 w-4" />
                          </ConfirmButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

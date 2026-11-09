import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { getConfig } from "@/lib/config";
import { PageHeader, EmptyState } from "@/components/ui";
import { PendenciasLista, type PendenciaItem } from "@/components/pendencias-lista";
import { formatCurrency, formatNumeroOS, hojeYmdLocal, STATUS_OS_LABEL } from "@/lib/format";
import { saldoEmAberto } from "@/lib/financeiro";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  tipo: "receita" | "despesa";
  descricao: string;
  valor: number;
  valor_pago: number;
  juros: number;
  multa: number;
  data_vencimento: string | null;
  os_id: string | null;
  clientes: { nome: string } | null;
  ordens_servico: { numero: number; status: string; data_conclusao: string | null } | null;
};

/** Títulos vencidos em aberto: dar baixa (já pago) ou encerrar (não será cobrado). */
export default async function PendenciasPage() {
  await requirePermissao("financeiro");
  const supabase = await createClient();
  const hoje = hojeYmdLocal();
  const { financeiro_inicio: corte } = await getConfig();

  const rows: Row[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from("lancamentos_financeiros")
      .select("id, tipo, descricao, valor, valor_pago, juros, multa, data_vencimento, os_id, clientes(nome), ordens_servico(numero, status, data_conclusao)")
      .in("status", ["pendente", "parcial"])
      .lt("data_vencimento", hoje)
      .gte("data_vencimento", corte ?? "1900-01-01")
      .order("data_vencimento")
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data || []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const dias = (d: string) => Math.round((Date.parse(hoje) - Date.parse(d)) / 86_400_000);
  const itens = rows
    .map((r) => ({ r, saldo: saldoEmAberto(r) }))
    .filter((x) => x.saldo > 0)
    .map(({ r, saldo }): PendenciaItem & { tipo: Row["tipo"] } => ({
      id: r.id,
      tipo: r.tipo,
      descricao: r.descricao,
      cliente: r.clientes?.nome ?? null,
      saldo,
      pago: Number(r.valor_pago) || 0,
      vencimento: r.data_vencimento,
      osId: r.os_id,
      osNumero: r.ordens_servico ? formatNumeroOS(r.ordens_servico.numero) : null,
      osStatus: r.ordens_servico ? STATUS_OS_LABEL[r.ordens_servico.status] ?? r.ordens_servico.status : null,
      osConclusao: r.ordens_servico?.data_conclusao ?? null,
      diasAtraso: r.data_vencimento ? dias(r.data_vencimento) : 0,
    }));

  const receber = itens.filter((i) => i.tipo === "receita");
  const pagar = itens.filter((i) => i.tipo === "despesa");
  const soma = (l: PendenciaItem[]) => l.reduce((s, i) => s + i.saldo, 0);

  return (
    <div>
      <Link href="/financeiro/fluxo" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Fluxo de caixa
      </Link>
      <PageHeader
        title="Pendências do financeiro"
        subtitle={`Títulos vencidos em aberto${corte ? ` desde ${corte.split("-").reverse().join("/")}` : ""} — a receber ${formatCurrency(soma(receber))} • a pagar ${formatCurrency(soma(pagar))}`}
      />
      <p className="mb-4 max-w-3xl text-sm text-slate-600">
        Se o cliente já pagou (ou você já pagou a conta) e isso não foi registrado, marque e use <strong>“Já foi recebido/pago”</strong> —
        o pagamento entra no caixa na data escolhida. Se não será cobrado, use <strong>“Não será cobrado”</strong>. Cada título continua
        podendo ser aberto e corrigido individualmente.
      </p>
      {itens.length === 0 ? (
        <EmptyState title="Nenhuma pendência vencida" description="O financeiro está em dia." />
      ) : (
        <>
          <PendenciasLista titulo="A receber (vencidos)" tipo="receita" itens={receber} />
          <PendenciasLista titulo="A pagar (vencidos)" tipo="despesa" itens={pagar} />
        </>
      )}
    </div>
  );
}

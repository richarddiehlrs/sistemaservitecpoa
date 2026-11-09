import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { getConfig } from "@/lib/config";
import { PageHeader, EmptyState } from "@/components/ui";
import { EncerrarOsLista, type OsAntiga } from "@/components/encerrar-os-lista";
import { STATUS_OS_ABERTAS } from "@/lib/os-status";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

/** OS abertas de antes do início do financeiro: encerrar sem gerar lançamentos. */
export default async function EncerrarAntigasPage() {
  await requirePermissao("ordens_excluir");
  const supabase = await createClient();
  const config = await getConfig();
  const corte = config.financeiro_inicio;

  if (!corte) {
    return (
      <div>
        <PageHeader title="Encerrar OS antigas" subtitle="Defina primeiro a data de início do financeiro" />
        <EmptyState title="Sem data de início do financeiro" description="Informe a data em Configurações." />
      </div>
    );
  }

  const { data: ordens } = await supabase
    .from("ordens_servico")
    .select("id, numero, status, data_abertura, data_aprovacao, valor_total, clientes(nome)")
    .in("status", [...STATUS_OS_ABERTAS])
    .lt("data_abertura", `${corte}T00:00:00-03:00`)
    .order("numero");

  const ids = (ordens || []).map((o) => o.id);
  const pagoPorOs = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("lancamentos_financeiros")
      .select("os_id, valor_pago")
      .eq("tipo", "receita")
      .neq("status", "cancelado")
      .in("os_id", ids.slice(i, i + 150));
    for (const r of data || []) {
      if (r.os_id) pagoPorOs.set(r.os_id, (pagoPorOs.get(r.os_id) ?? 0) + Number(r.valor_pago || 0));
    }
  }

  const itens: OsAntiga[] = (ordens || []).map((o) => {
    const extra = o as unknown as { clientes?: { nome?: string } | null; data_aprovacao?: string | null };
    return {
      id: o.id,
      numero: o.numero,
      cliente: extra.clientes?.nome ?? "—",
      status: o.status,
      abertura: o.data_abertura ? String(o.data_abertura).slice(0, 10) : null,
      aprovacao: extra.data_aprovacao ? String(extra.data_aprovacao).slice(0, 10) : null,
      total: Number(o.valor_total || 0),
      pago: pagoPorOs.get(o.id) ?? 0,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/manutencao" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Manutenção
      </Link>
      <PageHeader title="Encerrar OS antigas" subtitle={`OS em aberto criadas antes do início do financeiro (${formatDate(corte)})`} />
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
        <div className="space-y-1">
          <p>
            <strong>Já foi feita:</strong> a OS vai para Entregue e a receita sem pagamento é cancelada. Não cria faturamento nem
            pagamento — o caixa e a conciliação não mudam.
          </p>
          <p>
            <strong>Não foi feita:</strong> a OS é cancelada.
          </p>
          <p>Pagamentos já registrados e despesas de peças são mantidos. Se ainda vai atender alguma, não marque — ela continua aberta.</p>
        </div>
      </div>
      {itens.length === 0 ? (
        <EmptyState title="Nenhuma OS antiga em aberto" description="Tudo certo a partir do início do financeiro." />
      ) : (
        <EncerrarOsLista itens={itens} />
      )}
    </div>
  );
}

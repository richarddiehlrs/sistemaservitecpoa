import Link from "next/link";
import { Plus, LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { nomeTecnico } from "@/lib/permissoes";
import { PageHeader } from "@/components/ui";
import { PainelAtendimentos, type OsPainel } from "@/components/painel-atendimentos";
import { STATUS_PAINEL_ATIVOS } from "@/lib/painel-atendimento";

export const dynamic = "force-dynamic";

export default async function PainelAtendimentosPage() {
  const profile = await requirePermissao("ordens");
  const supabase = await createClient();

  let query = supabase
    .from("ordens_servico")
    .select("id, numero, status, tipo_atendimento, tecnico, data_previsao, prioridade, clientes(nome)")
    .in("status", STATUS_PAINEL_ATIVOS)
    .order("numero", { ascending: true });

  if (profile.papel === "tecnico") {
    const tecnico = nomeTecnico(profile);
    query = query.or(`tecnico_id.eq.${profile.id},tecnico.ilike.%${tecnico}%`);
  }

  const { data: ordens } = await query;

  const lista: OsPainel[] = (ordens || []).map((o) => ({
    id: o.id,
    numero: o.numero,
    status: o.status,
    tipo_atendimento: (o.tipo_atendimento as OsPainel["tipo_atendimento"]) || "domicilio",
    tecnico: o.tecnico,
    data_previsao: o.data_previsao,
    prioridade: o.prioridade,
    // @ts-expect-error relação
    cliente_nome: o.clientes?.nome || "—",
  }));

  return (
    <div>
      <PageHeader
        title="Painel de atendimentos"
        subtitle="Visão em tempo real — domicílio por status e oficina em grade de bancada"
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/ordens/nova?tipo=domicilio" className="btn-secondary">
              <Plus className="h-4 w-4" /> OS domicílio
            </Link>
            <Link href="/ordens/nova?tipo=oficina" className="btn-primary">
              <Plus className="h-4 w-4" /> OS oficina
            </Link>
          </div>
        }
      />

      {lista.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-slate-500">
          <LayoutGrid className="h-12 w-12 text-slate-300" />
          <p>Nenhuma OS ativa no painel.</p>
          <Link href="/ordens/nova" className="btn-primary">
            Abrir ordem de serviço
          </Link>
        </div>
      ) : (
        <PainelAtendimentos ordens={lista} />
      )}
    </div>
  );
}

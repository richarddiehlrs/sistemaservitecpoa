import { notFound, redirect } from "next/navigation";
import { STATUS_OS_BLOQUEADO_EDICAO } from "@/lib/transicao-status";
import type { StatusOS } from "@/types/database";
import { PageHeader } from "@/components/ui";
import { OrdemForm } from "@/components/ordem-form";
import { createClient } from "@/lib/supabase/server";
import { requirePermissao } from "@/lib/auth-guard";
import { assertOsAtribuida } from "@/lib/os-acesso";
import { nomeTecnico } from "@/lib/permissoes";
import { mapTecnicos } from "@/lib/tecnicos";
import { carregarEquipamentosOs } from "@/lib/os-equipamentos";
import { atualizarOrdem } from "../../actions";
import { formatNumeroOS } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditarOrdemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requirePermissao("ordens_editar");
  const supabase = await createClient();
  const ehTecnico = profile.papel === "tecnico";

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("*, clientes(id, nome, telefone)")
    .eq("id", id)
    .single();

  if (!os) notFound();

  if (ehTecnico) {
    assertOsAtribuida(profile, { tecnico_id: os.tecnico_id, tecnico: os.tecnico });
  }

  if (
    STATUS_OS_BLOQUEADO_EDICAO.includes(os.status as StatusOS) &&
    profile.papel !== "admin"
  ) {
    redirect(`/ordens/${id}`);
  }

  const [{ data: itens }, { data: equipamentos }, { data: catalogo }, { data: perfisTecnicos }, equipamentosOs] =
    await Promise.all([
    supabase.from("os_itens").select("*").eq("os_id", id).order("created_at"),
    supabase
      .from("equipamentos")
      .select("*")
      .eq("cliente_id", os.cliente_id)
      .order("created_at", { ascending: false }),
    supabase.from("servicos_catalogo").select("*").eq("ativo", true).order("descricao"),
    supabase.from("profiles").select("*").eq("papel", "tecnico").eq("ativo", true).order("nome"),
    carregarEquipamentosOs(supabase, id),
  ]);
  const tecnicos = mapTecnicos(perfisTecnicos || []);

  // @ts-expect-error relação embutida
  const clienteInicial = os.clientes;
  const action = atualizarOrdem.bind(null, id);

  return (
    <div>
      <PageHeader title={`Editar ${formatNumeroOS(os.numero)}`} subtitle="Atualização da ordem de serviço" />
      <OrdemForm
        action={action}
        ordem={os}
        clienteInicial={clienteInicial}
        equipamentos={equipamentos || []}
        equipamentosOsIniciais={equipamentosOs}
        itensIniciais={itens || []}
        catalogo={catalogo || []}
        modoEdicao
        tecnicoPadrao={ehTecnico ? nomeTecnico(profile) : undefined}
        tecnicoIdPadrao={ehTecnico ? profile.id : undefined}
        tecnicoFixo={ehTecnico}
        tecnicos={tecnicos}
      />
    </div>
  );
}

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { OsViaPrint } from "@/components/os-via-print";
import { getConfig } from "@/lib/config";
import { carregarEquipamentosOs } from "@/lib/os-equipamentos";

export const dynamic = "force-dynamic";

export default async function ImprimirOsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("*, clientes(*), equipamentos(*)")
    .eq("id", id)
    .single();

  if (!os) notFound();

  const [{ data: itens }, { data: anexos }, config, equips] = await Promise.all([
    supabase.from("os_itens").select("*").eq("os_id", id).order("created_at"),
    supabase.from("os_anexos").select("*").eq("os_id", id).eq("momento", "cliente_ausente").order("created_at"),
    getConfig(),
    carregarEquipamentosOs(supabase, id),
  ]);

  // @ts-expect-error relação embutida
  const cliente = os.clientes;
  // @ts-expect-error relação embutida
  const equip = os.equipamentos;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const publicUrl = siteUrl ? `${siteUrl}/os/${os.aprovacao_token}` : "";

  const viaProps = {
    os,
    cliente,
    equip,
    equips,
    itens: (itens || []).map((it) => ({
      ...it,
      subtotal: Number(it.quantidade) * Number(it.valor_unitario),
    })),
    anexosAusente: anexos || [],
    config,
    publicUrl,
    layout: "meia-pagina" as const,
  };

  return (
    <>
      <PrintButton />
      <div className="folha-a4 folha-a4-duas-vias">
        <OsViaPrint {...viaProps} via="Via do Cliente" />
        <div className="linha-corte">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
        <OsViaPrint {...viaProps} via="Via da Empresa" />
      </div>
    </>
  );
}

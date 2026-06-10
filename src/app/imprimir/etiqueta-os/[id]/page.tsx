import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { EtiquetaOsPrint } from "@/components/etiqueta-os-print";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function ImprimirEtiquetaOsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  const { id } = await params;
  const { auto } = await searchParams;
  const supabase = await createClient();

  const { data: os } = await supabase
    .from("ordens_servico")
    .select("*, clientes(*), equipamentos(*)")
    .eq("id", id)
    .single();

  if (!os) notFound();

  if (os.tipo_atendimento !== "oficina") {
    notFound();
  }

  const config = await getConfig();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  // @ts-expect-error relação embutida
  const cliente = os.clientes;
  // @ts-expect-error relação embutida
  const equip = os.equipamentos;

  return (
    <>
      <PrintButton auto={auto === "1"} bodyClass="modo-etiqueta" />
      <EtiquetaOsPrint
        os={os}
        cliente={cliente}
        equip={equip}
        empresaNome={config.empresa_nome || "ServitecPoa"}
        siteUrl={siteUrl}
      />
    </>
  );
}

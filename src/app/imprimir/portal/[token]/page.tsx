import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { OsViaPrint, type OsViaPrintData } from "@/components/os-via-print";

export const dynamic = "force-dynamic";

export default async function ImprimirPortalOsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("os_publica", { p_token: token });
  const os = data as Record<string, unknown> | null;

  if (error || !os || !os.numero) notFound();

  const empresa = (os.empresa || {}) as Record<string, string | null>;
  const itens = (os.itens || []) as {
    descricao: string;
    tipo?: string;
    quantidade: number;
    valor_unitario: number;
    subtotal: number;
  }[];
  const anexosAusente = (os.anexos_ausente || []) as { url: string }[];
  const historico = (os.historico || []) as {
    status: string;
    observacao?: string | null;
    created_at: string;
  }[];

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const publicUrl = siteUrl ? `${siteUrl}/os/${token}` : "";

  return (
    <>
      <PrintButton auto />
      <div className="folha-a4 folha-a4-uma-via">
        <OsViaPrint
          os={{
            numero: os.numero as number,
            status: os.status as string,
            data_abertura: os.data_abertura as string,
            data_previsao: os.data_previsao as string | null,
            turno: os.turno as string | null,
            data_aprovacao: os.data_aprovacao as string | null,
            tecnico: os.tecnico as string | null,
            defeito_relatado: os.defeito as string | null,
            diagnostico: os.diagnostico as string | null,
            servico_executado: os.servico as string | null,
            acompanha: os.acompanha as string | null,
            estado_aparelho: os.estado_aparelho as string | null,
            valor_itens: Number(os.valor_itens),
            valor_visita: Number(os.valor_visita),
            abater_visita: Boolean(os.abater_visita),
            desconto: Number(os.desconto),
            acrescimo: Number(os.acrescimo),
            garantia_dias: Number(os.garantia_dias),
            aprovado: Boolean(os.aprovado),
            assinatura_cliente: os.assinatura_cliente as string | null,
            assinatura_tecnico: os.assinatura_tecnico as string | null,
            observacao_cliente_ausente: os.observacao_cliente_ausente as string | null,
            cliente_ausente_registrado_at: os.cliente_ausente_registrado_at as string | null,
          }}
          cliente={os.cliente as OsViaPrintData["cliente"]}
          clienteNome={os.cliente_nome as string}
          equip={os.equipamento_detalhe as OsViaPrintData["equip"]}
          equipamentoTexto={os.equipamento as string}
          itens={itens}
          anexosAusente={anexosAusente}
          historico={historico}
          config={{
            nome: empresa.nome || "Assistência Técnica",
            cnpj: empresa.cnpj || undefined,
            telefone: empresa.telefone || undefined,
            email: empresa.email || undefined,
            endereco: empresa.endereco || undefined,
            cidade: empresa.cidade || undefined,
            logo_url: empresa.logo_url,
            termo_garantia: empresa.termo_garantia || undefined,
            politica_os: empresa.politica_os || undefined,
          }}
          publicUrl={publicUrl}
          via="Via do Cliente"
          layout="pagina-inteira"
          showGoogleQr
        />
      </div>
    </>
  );
}

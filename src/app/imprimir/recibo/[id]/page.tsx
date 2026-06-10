import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { getConfig } from "@/lib/config";
import { formatCurrency, formatDate, valorPorExtenso } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lanc } = await supabase
    .from("lancamentos_financeiros")
    .select("*, clientes(nome, cpf_cnpj), ordens_servico(numero)")
    .eq("id", id)
    .single();

  if (!lanc) notFound();

  const config = await getConfig();
  // @ts-expect-error relação
  const cliente = lanc.clientes;
  // @ts-expect-error relação
  const os = lanc.ordens_servico;

  const valor = Number(lanc.valor_pago) > 0 ? Number(lanc.valor_pago) : Number(lanc.valor);
  const numeroRecibo = id.slice(0, 8).toUpperCase();
  const dataRef = lanc.data_pagamento || lanc.data_competencia;

  return (
    <>
      <PrintButton />
      <div className="folha-a4">
        <ReciboVia config={config} cliente={cliente} os={os} lanc={lanc} valor={valor} numeroRecibo={numeroRecibo} dataRef={dataRef} via="1ª via" />
        <div className="linha-corte">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
        <ReciboVia config={config} cliente={cliente} os={os} lanc={lanc} valor={valor} numeroRecibo={numeroRecibo} dataRef={dataRef} via="2ª via" />
      </div>
    </>
  );
}

function ReciboVia({
  config,
  cliente,
  os,
  lanc,
  valor,
  numeroRecibo,
  dataRef,
  via,
}: {
  config: any;
  cliente: any;
  os: any;
  lanc: any;
  valor: number;
  numeroRecibo: string;
  dataRef: string;
  via: string;
}) {
  const extenso = valorPorExtenso(valor);
  return (
    <div className="via-os" style={{ fontSize: 12, color: "#0f172a", lineHeight: 1.5, padding: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1d4ed8", paddingBottom: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {config.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_url} alt="logo" style={{ height: 46, width: "auto", objectFit: "contain" }} />
          )}
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1d4ed8" }}>{config.nome}</div>
            <div style={{ fontSize: 9, color: "#475569" }}>
              {config.cnpj && `CNPJ: ${config.cnpj} • `}{config.telefone}
            </div>
            <div style={{ fontSize: 9, color: "#475569" }}>{config.email}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>RECIBO</div>
          <div style={{ fontSize: 10 }}>Nº {numeroRecibo}</div>
          <div style={{ fontSize: 9, color: "#1d4ed8", fontWeight: 700 }}>{via}</div>
        </div>
      </div>

      <div style={{ textAlign: "right", margin: "10px 0", fontSize: 16, fontWeight: 700, color: "#1d4ed8" }}>
        {formatCurrency(valor)}
      </div>

      <p style={{ margin: "8px 0", textAlign: "justify" }}>
        Recebemos de <strong>{cliente?.nome || "Cliente"}</strong>
        {cliente?.cpf_cnpj && <> (CPF/CNPJ: {cliente.cpf_cnpj})</>} a importância de{" "}
        <strong>{formatCurrency(valor)}</strong> (<em>{extenso}</em>), referente a{" "}
        <strong>{lanc.descricao}</strong>
        {os?.numero && <> — OS Nº {String(os.numero).padStart(5, "0")}</>}
        {lanc.forma_pagamento && <>, na forma de {lanc.forma_pagamento}</>}.
      </p>

      {lanc.status === "parcial" && (
        <p style={{ margin: "4px 0", fontSize: 10, color: "#475569" }}>
          Pagamento parcial. Valor total do título: {formatCurrency(Number(lanc.valor) + Number(lanc.juros) + Number(lanc.multa))}.
        </p>
      )}

      <p style={{ margin: "8px 0" }}>
        Para maior clareza, firmamos o presente recibo.
      </p>

      <div style={{ marginTop: 18, textAlign: "right", fontSize: 11 }}>
        {config.cidade || "Porto Alegre"}, {formatDate(dataRef)}.
      </div>

      <div style={{ marginTop: 30, textAlign: "center" }}>
        <div style={{ borderTop: "1px solid #0f172a", width: 260, margin: "0 auto", paddingTop: 3, fontSize: 11 }}>
          {config.nome}
        </div>
      </div>
    </div>
  );
}

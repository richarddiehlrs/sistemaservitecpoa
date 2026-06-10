import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { getConfig } from "@/lib/config";
import {
  formatCurrency,
  formatCpfCnpj,
  formatCep,
  formatDate,
  formatNumeroOS,
  formatTelefone,
} from "@/lib/format";

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

  const { data: itens } = await supabase
    .from("os_itens")
    .select("*")
    .eq("os_id", id)
    .order("created_at");

  const config = await getConfig();

  // @ts-expect-error relação embutida
  const cliente = os.clientes;
  // @ts-expect-error relação embutida
  const equip = os.equipamentos;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const publicUrl = siteUrl ? `${siteUrl}/os/${os.aprovacao_token}` : "";

  const dados = { os, cliente, equip, itens: itens || [], config, publicUrl };

  return (
    <>
      <PrintButton />
      <div className="folha-a4">
        <ViaOS {...dados} via="Via do Cliente" />
        <div className="linha-corte">✂ - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -</div>
        <ViaOS {...dados} via="Via da Empresa" />
      </div>
    </>
  );
}

function ViaOS({
  os,
  cliente,
  equip,
  itens,
  config,
  publicUrl,
  via,
}: {
  os: any;
  cliente: any;
  equip: any;
  itens: any[];
  config: any;
  publicUrl: string;
  via: string;
}) {
  return (
    <div className="via-os" style={{ fontSize: 11, color: "#0f172a", lineHeight: 1.35 }}>
      {/* Cabeçalho */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1d4ed8", paddingBottom: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {config.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_url} alt="logo" style={{ height: 46, width: "auto", objectFit: "contain" }} />
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1d4ed8" }}>{config.nome}</div>
            <div style={{ fontSize: 9, color: "#475569" }}>
              {config.cnpj && `CNPJ: ${config.cnpj} • `}{config.endereco}
            </div>
            <div style={{ fontSize: 9, color: "#475569" }}>
              {config.telefone && `Fone: ${config.telefone} • `}{config.email}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{formatNumeroOS(os.numero)}</div>
          <div style={{ fontSize: 9 }}>Abertura: {formatDate(os.data_abertura)}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#1d4ed8" }}>{via}</div>
        </div>
      </div>

      {/* Cliente / Equipamento */}
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <Bloco titulo="CLIENTE" style={{ flex: 1 }}>
          <strong>{cliente?.nome}</strong><br />
          {cliente?.cpf_cnpj && <>CPF/CNPJ: {formatCpfCnpj(cliente.cpf_cnpj)}<br /></>}
          {cliente?.telefone && <>Fone: {formatTelefone(cliente.telefone)}<br /></>}
          {[cliente?.logradouro, cliente?.numero, cliente?.complemento].filter(Boolean).join(", ")}<br />
          {[cliente?.bairro, cliente?.cidade && `${cliente.cidade}/${cliente.uf ?? ""}`].filter(Boolean).join(" - ")}
          {cliente?.cep && <> • CEP {formatCep(cliente.cep)}</>}
        </Bloco>
        <Bloco titulo="EQUIPAMENTO" style={{ flex: 1 }}>
          {equip ? (
            <>
              <strong>{equip.tipo} {equip.marca}</strong> {equip.modelo}<br />
              {equip.numero_serie && <>Série: {equip.numero_serie}<br /></>}
              {equip.voltagem && <>Voltagem: {equip.voltagem} </>}
              {equip.cor && <>• Cor: {equip.cor}</>}
            </>
          ) : "—"}
        </Bloco>
      </div>

      {/* Defeito / diagnóstico */}
      <div style={{ marginTop: 6 }}>
        {os.defeito_relatado && <CampoLinha titulo="Defeito relatado" valor={os.defeito_relatado} />}
        {os.acompanha && <CampoLinha titulo="Acompanha" valor={os.acompanha} />}
        {os.estado_aparelho && <CampoLinha titulo="Estado do aparelho" valor={os.estado_aparelho} />}
        {os.diagnostico && <CampoLinha titulo="Diagnóstico" valor={os.diagnostico} />}
        {os.servico_executado && <CampoLinha titulo="Serviço executado" valor={os.servico_executado} />}
      </div>

      {/* Itens */}
      {itens.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6, fontSize: 10 }}>
          <thead>
            <tr style={{ background: "#eff6ff" }}>
              <th style={thStyle}>Descrição</th>
              <th style={{ ...thStyle, textAlign: "center", width: 40 }}>Qtd</th>
              <th style={{ ...thStyle, textAlign: "right", width: 70 }}>Unit.</th>
              <th style={{ ...thStyle, textAlign: "right", width: 70 }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it) => (
              <tr key={it.id}>
                <td style={tdStyle}>{it.descricao} <em style={{ color: "#94a3b8" }}>({it.tipo})</em></td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{it.quantidade}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(it.valor_unitario)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totais */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <table style={{ fontSize: 10, minWidth: 220 }}>
          <tbody>
            <LinhaTotal titulo="Serviços + peças" valor={formatCurrency(os.valor_itens)} />
            {os.acrescimo > 0 && <LinhaTotal titulo="Acréscimo" valor={`+ ${formatCurrency(os.acrescimo)}`} />}
            {os.desconto > 0 && <LinhaTotal titulo="Desconto" valor={`- ${formatCurrency(os.desconto)}`} />}
            <LinhaTotal
              titulo={`Visita técnica${os.abater_visita ? " (abatida)" : ""}`}
              valor={`${os.abater_visita ? "- " : ""}${formatCurrency(os.valor_visita)}`}
            />
            <tr>
              <td style={{ fontWeight: 700, borderTop: "1px solid #1d4ed8", paddingTop: 3 }}>TOTAL</td>
              <td style={{ fontWeight: 700, textAlign: "right", borderTop: "1px solid #1d4ed8", paddingTop: 3, color: "#1d4ed8" }}>
                {formatCurrency(os.valor_total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Termo de garantia + QR */}
      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "flex-start" }}>
        <div style={{ flex: 1, fontSize: 8, color: "#475569" }}>
          {config.termo_garantia && (
            <p style={{ margin: 0 }}><strong>Garantia:</strong> {config.termo_garantia}</p>
          )}
          {config.politica_os && (
            <p style={{ margin: "2px 0 0" }}>{config.politica_os}</p>
          )}
          {!config.termo_garantia && (
            <p style={{ margin: 0 }}>Garantia do serviço: <strong>{os.garantia_dias} dias</strong>.</p>
          )}
        </div>
        {publicUrl && (
          <div style={{ textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(publicUrl)}`}
              alt="QR"
              style={{ width: 64, height: 64 }}
            />
            <div style={{ fontSize: 7, color: "#64748b", maxWidth: 70 }}>Acompanhe/aprove sua OS</div>
          </div>
        )}
      </div>

      {/* Assinaturas */}
      <div style={{ display: "flex", gap: 24, marginTop: 14, alignItems: "flex-end" }}>
        {os.assinatura_cliente ? (
          <div style={{ flex: 1, textAlign: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={os.assinatura_cliente} alt="assinatura" style={{ height: 40, objectFit: "contain" }} />
            <div style={{ borderTop: "1px solid #0f172a", paddingTop: 2, fontSize: 9 }}>
              Assinatura do cliente {os.aprovado ? "(aprovado)" : ""}
            </div>
          </div>
        ) : (
          <Assinatura label="Assinatura do cliente" />
        )}
        <Assinatura label="Responsável técnico" />
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { border: "1px solid #cbd5e1", padding: "3px 5px", textAlign: "left", fontSize: 9 };
const tdStyle: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "3px 5px" };

function Bloco({ titulo, children, style }: { titulo: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ border: "1px solid #cbd5e1", borderRadius: 4, padding: 6, ...style }}>
      <div style={{ fontSize: 8, fontWeight: 700, color: "#1d4ed8", marginBottom: 2 }}>{titulo}</div>
      <div style={{ fontSize: 10 }}>{children}</div>
    </div>
  );
}

function CampoLinha({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <span style={{ fontWeight: 700, fontSize: 9, color: "#475569" }}>{titulo}: </span>
      <span style={{ fontSize: 10 }}>{valor}</span>
    </div>
  );
}

function LinhaTotal({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <tr>
      <td style={{ color: "#475569", paddingRight: 16 }}>{titulo}</td>
      <td style={{ textAlign: "right" }}>{valor}</td>
    </tr>
  );
}

function Assinatura({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ borderTop: "1px solid #0f172a", marginTop: 8, paddingTop: 2, fontSize: 9 }}>{label}</div>
    </div>
  );
}

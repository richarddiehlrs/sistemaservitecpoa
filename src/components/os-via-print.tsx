import {
  formatCurrency,
  formatCpfCnpj,
  formatCep,
  formatDate,
  formatDateTime,
  formatNumeroOS,
  formatTelefone,
  STATUS_OS_LABEL,
} from "@/lib/format";
import { calcValorTotalCliente, linhaVisitaValor } from "@/lib/os-valores";
import { pixCopiaCola, PIX_CHAVE_CNPJ, GOOGLE_REVIEW_URL, formatPixCnpj } from "@/lib/pix";
import { qrImageUrl } from "@/lib/qrcode";

const MAX_ITENS = 5;
const MAX_TEXTO = 120;

export type OsViaPrintData = {
  os: {
    numero: number;
    status: string;
    data_abertura: string;
    tecnico?: string | null;
    defeito_relatado?: string | null;
    acompanhia?: string | null;
    acompanha?: string | null;
    estado_aparelho?: string | null;
    diagnostico?: string | null;
    servico_executado?: string | null;
    valor_itens: number;
    valor_visita: number;
    abater_visita: boolean;
    desconto: number;
    acrescimo: number;
    garantia_dias: number;
    aprovado?: boolean;
    assinatura_cliente?: string | null;
    assinatura_tecnico?: string | null;
    observacao_cliente_ausente?: string | null;
    cliente_ausente_registrado_at?: string | null;
  };
  cliente?: {
    nome?: string;
    cpf_cnpj?: string;
    telefone?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  } | null;
  clienteNome?: string;
  equip?: {
    tipo?: string;
    marca?: string;
    modelo?: string;
    numero_serie?: string;
    voltagem?: string;
    cor?: string;
  } | null;
  equipamentoTexto?: string;
  itens: { id?: string; descricao: string; tipo?: string; quantidade: number; valor_unitario: number; subtotal: number }[];
  anexosAusente?: { url: string }[];
  config: {
    nome: string;
    cnpj?: string;
    telefone?: string;
    email?: string;
    endereco?: string;
    cidade?: string;
    logo_url?: string | null;
    termo_garantia?: string;
    politica_os?: string;
  };
  publicUrl?: string;
  via: string;
  compact?: boolean;
  showGoogleQr?: boolean;
};

export function OsViaPrint(props: OsViaPrintData) {
  const { os, cliente, equip, itens, anexosAusente = [], config, publicUrl, via, compact = false, showGoogleQr = false } = props;
  const clienteNome = props.clienteNome || cliente?.nome;
  const fs = compact ? 8 : 9;

  const valorTotal = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  const visitaLinha = linhaVisitaValor(Number(os.valor_visita), os.abater_visita);
  const itensVisiveis = itens.slice(0, MAX_ITENS);
  const itensExtras = itens.length - itensVisiveis.length;

  const pixPayload = pixCopiaCola({
    nome: config.nome,
    cidade: config.cidade,
    valor: valorTotal > 0 ? valorTotal : undefined,
  });

  return (
    <div className="via-os" style={{ fontSize: fs, color: "#0f172a", lineHeight: 1.22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1d4ed8", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", minWidth: 0, flex: 1 }}>
          {config.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_url} alt="logo" style={{ height: compact ? 32 : 38, width: "auto", objectFit: "contain", flexShrink: 0 }} />
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700, color: "#1d4ed8" }}>{config.nome}</div>
            <div style={{ fontSize: 7, color: "#475569" }}>
              {config.cnpj && `CNPJ: ${config.cnpj} • `}{config.endereco}
            </div>
            <div style={{ fontSize: 7, color: "#475569" }}>
              {config.telefone && `Fone: ${config.telefone} • `}{config.email}
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: compact ? 11 : 12, fontWeight: 700 }}>{formatNumeroOS(os.numero)}</div>
          <div style={{ fontSize: 7 }}>Abertura: {formatDate(os.data_abertura)}</div>
          {os.tecnico && <div style={{ fontSize: 7 }}>Técnico: {os.tecnico}</div>}
          <div style={{ fontSize: 7, color: "#64748b" }}>{STATUS_OS_LABEL[os.status] || os.status}</div>
          <div style={{ fontSize: 7, fontWeight: 700, color: "#1d4ed8" }}>{via}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        <Bloco titulo="CLIENTE" style={{ flex: 1 }}>
          <strong>{clienteNome}</strong><br />
          {cliente?.cpf_cnpj && <>CPF/CNPJ: {formatCpfCnpj(cliente.cpf_cnpj)}<br /></>}
          {cliente?.telefone && <>Fone: {formatTelefone(cliente.telefone)}<br /></>}
          {cliente ? (
            <>
              {[cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(", ")}<br />
              {[cliente.bairro, cliente.cidade && `${cliente.cidade}/${cliente.uf ?? ""}`].filter(Boolean).join(" - ")}
              {cliente.cep && <> • CEP {formatCep(cliente.cep)}</>}
            </>
          ) : null}
        </Bloco>
        <Bloco titulo="EQUIPAMENTO" style={{ flex: 1 }}>
          {equip ? (
            <>
              <strong>{equip.tipo} {equip.marca}</strong> {equip.modelo}<br />
              {equip.numero_serie && <>Série: {equip.numero_serie}<br /></>}
              {equip.voltagem && <>Voltagem: {equip.voltagem} </>}
              {equip.cor && <>• Cor: {equip.cor}</>}
            </>
          ) : props.equipamentoTexto ? (
            props.equipamentoTexto
          ) : (
            "—"
          )}
        </Bloco>
      </div>

      <div style={{ marginTop: 4 }}>
        {os.defeito_relatado && <CampoLinha titulo="Defeito" valor={os.defeito_relatado} />}
        {(os.acompanha || os.acompanhia) && <CampoLinha titulo="Acompanha" valor={(os.acompanha || os.acompanhia)!} />}
        {os.estado_aparelho && <CampoLinha titulo="Estado" valor={os.estado_aparelho} />}
        {os.diagnostico && <CampoLinha titulo="Diagnóstico" valor={os.diagnostico} />}
        {os.servico_executado && <CampoLinha titulo="Serviço" valor={os.servico_executado} />}
      </div>

      {itensVisiveis.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: 7 }}>
          <thead>
            <tr style={{ background: "#eff6ff" }}>
              <th style={thStyle}>Descrição</th>
              <th style={{ ...thStyle, textAlign: "center", width: 28 }}>Qtd</th>
              <th style={{ ...thStyle, textAlign: "right", width: 52 }}>Unit.</th>
              <th style={{ ...thStyle, textAlign: "right", width: 52 }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itensVisiveis.map((it, i) => (
              <tr key={it.id || i}>
                <td style={tdStyle}>{it.descricao}{it.tipo ? <em style={{ color: "#94a3b8" }}> ({it.tipo})</em> : null}</td>
                <td style={{ ...tdStyle, textAlign: "center" }}>{it.quantidade}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(it.valor_unitario)}</td>
                <td style={{ ...tdStyle, textAlign: "right" }}>{formatCurrency(it.subtotal)}</td>
              </tr>
            ))}
            {itensExtras > 0 && (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, fontStyle: "italic", color: "#64748b" }}>
                  + {itensExtras} item(ns) não exibido(s)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, gap: 8, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {publicUrl && <QrBox img={qrImageUrl(publicUrl, 64)} titulo="Portal OS" sub="Acompanhe" />}
          <QrBox img={qrImageUrl(pixPayload, 64)} titulo="PIX" sub={formatPixCnpj(PIX_CHAVE_CNPJ)} />
          {showGoogleQr && <QrBox img={qrImageUrl(GOOGLE_REVIEW_URL, 64)} titulo="Avalie" sub="Google" />}
        </div>
        <table style={{ fontSize: 7, minWidth: 160, flexShrink: 0 }}>
          <tbody>
            <LinhaTotal titulo="Serviços + peças" valor={formatCurrency(os.valor_itens)} />
            {os.acrescimo > 0 && <LinhaTotal titulo="Acréscimo" valor={`+ ${formatCurrency(os.acrescimo)}`} />}
            {os.desconto > 0 && <LinhaTotal titulo="Desconto" valor={`- ${formatCurrency(os.desconto)}`} />}
            {visitaLinha.valor > 0 && (
              <LinhaTotal
                titulo={`Visita${os.abater_visita ? " (abatida)" : ""}`}
                valor={`${visitaLinha.prefixo}${formatCurrency(visitaLinha.valor)}`}
              />
            )}
            <tr>
              <td style={{ fontWeight: 700, borderTop: "1px solid #1d4ed8", paddingTop: 2 }}>TOTAL</td>
              <td style={{ fontWeight: 700, textAlign: "right", borderTop: "1px solid #1d4ed8", paddingTop: 2, color: "#1d4ed8" }}>
                {formatCurrency(valorTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {os.status === "cliente_ausente" && (
        <div style={{ marginTop: 4, border: "1px solid #fecdd3", borderRadius: 3, padding: 4, background: "#fff1f2", fontSize: 7 }}>
          <strong style={{ color: "#be123c" }}>CLIENTE AUSENTE</strong>
          {os.cliente_ausente_registrado_at && <> — {formatDateTime(os.cliente_ausente_registrado_at)}</>}
          {os.observacao_cliente_ausente && <> • {truncar(os.observacao_cliente_ausente, 80)}</>}
          {!compact && anexosAusente.length > 0 && <span> • {anexosAusente.length} foto(s)</span>}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "flex-start" }}>
        <div style={{ flex: 1, fontSize: 6.5, color: "#475569" }}>
          {config.termo_garantia ? (
            <p style={{ margin: 0 }}><strong>Garantia:</strong> {truncar(config.termo_garantia, 100)}</p>
          ) : (
            <p style={{ margin: 0 }}>Garantia: <strong>{os.garantia_dias} dias</strong>.</p>
          )}
          {config.politica_os && <p style={{ margin: "1px 0 0" }}>{truncar(config.politica_os, 80)}</p>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 6, alignItems: "flex-end" }}>
        {os.assinatura_cliente ? (
          <AssinaturaImg src={os.assinatura_cliente} label={`Cliente${os.aprovado ? " (aprovado)" : ""}`} />
        ) : (
          <Assinatura label="Assinatura do cliente" />
        )}
        {os.assinatura_tecnico ? (
          <AssinaturaImg src={os.assinatura_tecnico} label={`Técnico${os.tecnico ? ` — ${os.tecnico}` : ""}`} />
        ) : (
          <Assinatura label={`Técnico${os.tecnico ? ` — ${os.tecnico}` : ""}`} />
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = { border: "1px solid #cbd5e1", padding: "2px 4px", textAlign: "left", fontSize: 7 };
const tdStyle: React.CSSProperties = { border: "1px solid #e2e8f0", padding: "2px 4px" };

function truncar(s: string, max: number) {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function Bloco({ titulo, children, style }: { titulo: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ border: "1px solid #cbd5e1", borderRadius: 3, padding: 4, ...style }}>
      <div style={{ fontSize: 7, fontWeight: 700, color: "#1d4ed8", marginBottom: 1 }}>{titulo}</div>
      <div style={{ fontSize: 8 }}>{children}</div>
    </div>
  );
}

function CampoLinha({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ marginBottom: 1 }}>
      <span style={{ fontWeight: 700, fontSize: 7, color: "#475569" }}>{titulo}: </span>
      <span style={{ fontSize: 8 }}>{truncar(valor, MAX_TEXTO)}</span>
    </div>
  );
}

function LinhaTotal({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <tr>
      <td style={{ color: "#475569", paddingRight: 10 }}>{titulo}</td>
      <td style={{ textAlign: "right" }}>{valor}</td>
    </tr>
  );
}

function QrBox({ img, titulo, sub }: { img: string; titulo: string; sub: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={titulo} style={{ width: 48, height: 48 }} />
      <div style={{ fontSize: 6, fontWeight: 700, color: "#1d4ed8" }}>{titulo}</div>
      <div style={{ fontSize: 5.5, color: "#64748b", maxWidth: 54, lineHeight: 1.1 }}>{sub}</div>
    </div>
  );
}

function Assinatura({ label }: { label: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ borderTop: "1px solid #0f172a", marginTop: 4, paddingTop: 2, fontSize: 7 }}>{label}</div>
    </div>
  );
}

function AssinaturaImg({ src, label }: { src: string; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="assinatura" style={{ height: 28, objectFit: "contain" }} />
      <div style={{ borderTop: "1px solid #0f172a", paddingTop: 2, fontSize: 7 }}>{label}</div>
    </div>
  );
}

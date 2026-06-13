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
import { linhaEquipamento, type EquipamentoResumo } from "@/lib/os-equipamentos";
import { pixCopiaCola, PIX_CHAVE_CNPJ, GOOGLE_REVIEW_URL, formatPixCnpj } from "@/lib/pix";
import { qrImageUrl } from "@/lib/qrcode";
import { TURNO_LABEL } from "@/lib/turnos";

export type OsViaPrintData = {
  os: {
    numero: number;
    status: string;
    data_abertura: string;
    data_previsao?: string | null;
    turno?: string | null;
    data_aprovacao?: string | null;
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
  /** Lista completa de equipamentos (prioridade sobre equip/equipamentoTexto). */
  equips?: EquipamentoResumo[];
  equipamentoTexto?: string;
  itens: { id?: string; descricao: string; tipo?: string; quantidade: number; valor_unitario: number; subtotal: number }[];
  anexosAusente?: { url: string }[];
  historico?: { status: string; observacao?: string | null; created_at: string }[];
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
  /** meia-pagina = 2 vias na mesma folha A4 | pagina-inteira = portal / impressão completa */
  layout?: "meia-pagina" | "pagina-inteira";
  showGoogleQr?: boolean;
};

export function OsViaPrint(props: OsViaPrintData) {
  const {
    os,
    cliente,
    equip,
    equips: equipsProp,
    itens,
    anexosAusente = [],
    historico = [],
    config,
    publicUrl,
    via,
    layout = "meia-pagina",
    showGoogleQr = false,
  } = props;

  const inteira = layout === "pagina-inteira";
  const clienteNome = props.clienteNome || cliente?.nome;
  const equips =
    equipsProp?.length
      ? equipsProp
      : equip
        ? [equip]
        : props.equipamentoTexto
          ? [{ tipo: props.equipamentoTexto }]
          : [];
  const compacta = equips.length > 1 || itens.length > 5 || inteira === false && (equips.length + itens.length > 4);

  const valorTotal = calcValorTotalCliente(
    Number(os.valor_itens),
    Number(os.valor_visita),
    os.abater_visita,
    Number(os.desconto),
    Number(os.acrescimo)
  );
  const visitaLinha = linhaVisitaValor(Number(os.valor_visita), os.abater_visita);

  const pixPayload = pixCopiaCola({
    nome: config.nome,
    cidade: config.cidade,
    valor: valorTotal > 0 ? valorTotal : undefined,
  });

  const qrSize = inteira ? 90 : 68;
  const logoH = inteira ? 52 : 42;

  return (
    <div className={`via-os via-os--${layout}${compacta ? " via-os--compacta" : ""}`}>
      {/* Cabeçalho */}
      <header className="via-cabecalho">
        <div className="via-empresa">
          {config.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={config.logo_url} alt="logo" className="via-logo" style={{ height: logoH }} />
          )}
          <div>
            <div className="via-empresa-nome">{config.nome}</div>
            <div className="via-empresa-detalhe">
              {config.cnpj && <>CNPJ: {config.cnpj} • </>}{config.endereco}
            </div>
            <div className="via-empresa-detalhe">
              {config.telefone && <>Fone: {config.telefone} • </>}{config.email}
            </div>
          </div>
        </div>
        <div className="via-os-info">
          <div className="via-os-numero">{formatNumeroOS(os.numero)}</div>
          <div className="via-os-meta">Abertura: {formatDate(os.data_abertura)}</div>
          {os.data_previsao && (
            <div className="via-os-meta">
              Visita: {formatDate(os.data_previsao)}
              {os.turno && TURNO_LABEL[os.turno] ? ` — ${TURNO_LABEL[os.turno]}` : ""}
            </div>
          )}
          {os.tecnico && <div className="via-os-meta">Técnico: {os.tecnico}</div>}
          <div className="via-os-meta">Garantia: {os.garantia_dias} dias</div>
          <div className="via-os-status">{STATUS_OS_LABEL[os.status] || os.status}</div>
          {os.aprovado && os.data_aprovacao && (
            <div className="via-os-meta">Aprovado em {formatDate(os.data_aprovacao)}</div>
          )}
          <div className="via-os-via">{via}</div>
        </div>
      </header>

      {/* Cliente / Equipamento */}
      <div className="via-grid-2">
        <Bloco titulo="CLIENTE">
          <strong>{clienteNome}</strong>
          {cliente?.cpf_cnpj && <div>CPF/CNPJ: {formatCpfCnpj(cliente.cpf_cnpj)}</div>}
          {cliente?.telefone && <div>Fone: {formatTelefone(cliente.telefone)}</div>}
          {cliente ? (
            <>
              <div>{[cliente.logradouro, cliente.numero, cliente.complemento].filter(Boolean).join(", ")}</div>
              <div>
                {[cliente.bairro, cliente.cidade && `${cliente.cidade}/${cliente.uf ?? ""}`].filter(Boolean).join(" - ")}
                {cliente.cep && <> • CEP {formatCep(cliente.cep)}</>}
              </div>
            </>
          ) : null}
        </Bloco>
        <Bloco titulo={equips.length > 1 ? `EQUIPAMENTOS (${equips.length})` : "EQUIPAMENTO"}>
          {equips.length > 0 ? (
            equips.length === 1 ? (
              <>
                <div><strong>{equips[0].tipo} {equips[0].marca}</strong> {equips[0].modelo}</div>
                {equips[0].numero_serie && <div>Série: {equips[0].numero_serie}</div>}
                <div>
                  {equips[0].voltagem && <>Voltagem: {equips[0].voltagem} </>}
                  {equips[0].cor && <>• Cor: {equips[0].cor}</>}
                </div>
              </>
            ) : (
              <table className="via-equip-tabela">
                <tbody>
                  {equips.map((eq, i) => (
                    <tr key={i}>
                      <td className="via-equip-num">{i + 1}.</td>
                      <td>{linhaEquipamento(eq)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            "—"
          )}
        </Bloco>
      </div>

      {/* Defeito / diagnóstico */}
      <div className="via-campos">
        {os.defeito_relatado && <CampoLinha titulo="Defeito relatado" valor={os.defeito_relatado} />}
        {(os.acompanha || os.acompanhia) && <CampoLinha titulo="Acompanha" valor={(os.acompanha || os.acompanhia)!} />}
        {os.estado_aparelho && <CampoLinha titulo="Estado do aparelho" valor={os.estado_aparelho} />}
        {os.diagnostico && <CampoLinha titulo="Diagnóstico" valor={os.diagnostico} />}
        {os.servico_executado && <CampoLinha titulo="Serviço executado" valor={os.servico_executado} />}
      </div>

      {/* Itens */}
      {itens.length > 0 && (
        <table className="via-tabela">
          <thead>
            <tr>
              <th>Descrição</th>
              <th className="via-td-center">Qtd</th>
              <th className="via-td-right">Unit.</th>
              <th className="via-td-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={it.id || i}>
                <td>
                  {it.descricao}
                  {it.tipo ? <em className="via-tipo-item"> ({it.tipo})</em> : null}
                </td>
                <td className="via-td-center">{it.quantidade}</td>
                <td className="via-td-right">{formatCurrency(it.valor_unitario)}</td>
                <td className="via-td-right">{formatCurrency(it.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Totais + QR */}
      <div className="via-rodape-financeiro">
        <div className="via-qrs">
          {publicUrl && <QrBox img={qrImageUrl(publicUrl, qrSize)} titulo="Portal OS" sub="Acompanhe sua OS" />}
          <QrBox img={qrImageUrl(pixPayload, qrSize)} titulo="PIX" sub={`CNPJ ${formatPixCnpj(PIX_CHAVE_CNPJ)}`} />
          {showGoogleQr && <QrBox img={qrImageUrl(GOOGLE_REVIEW_URL, qrSize)} titulo="Avalie" sub="Google Reviews" />}
        </div>
        <table className="via-totais">
          <tbody>
            <LinhaTotal titulo="Serviços + peças" valor={formatCurrency(os.valor_itens)} />
            {os.acrescimo > 0 && <LinhaTotal titulo="Acréscimo" valor={`+ ${formatCurrency(os.acrescimo)}`} />}
            {os.desconto > 0 && <LinhaTotal titulo="Desconto" valor={`- ${formatCurrency(os.desconto)}`} />}
            {visitaLinha.valor > 0 && (
              <LinhaTotal
                titulo={`Visita técnica${os.abater_visita ? " (abatida)" : ""}`}
                valor={`${visitaLinha.prefixo}${formatCurrency(visitaLinha.valor)}`}
              />
            )}
            <tr className="via-total-final">
              <td>TOTAL</td>
              <td>{formatCurrency(valorTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cliente ausente */}
      {os.status === "cliente_ausente" && (
        <div className="via-ausente">
          <strong>CLIENTE AUSENTE — visita não realizada</strong>
          {os.cliente_ausente_registrado_at && (
            <div>Registrado em {formatDateTime(os.cliente_ausente_registrado_at)}</div>
          )}
          {os.observacao_cliente_ausente && <div>{os.observacao_cliente_ausente}</div>}
          {anexosAusente.length > 0 && (
            <div className="via-ausente-fotos">
              {anexosAusente.map((a, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={a.url} alt="Comprovante" />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Histórico (só página inteira / portal) */}
      {inteira && historico.length > 0 && (
        <div className="via-historico">
          <div className="via-bloco-titulo">ACOMPANHAMENTO</div>
          <ul>
            {historico.map((h, i) => (
              <li key={i}>
                <span className="via-hist-data">{formatDateTime(h.created_at)}</span>
                {" — "}
                <strong>{STATUS_OS_LABEL[h.status] || h.status}</strong>
                {h.observacao ? ` — ${h.observacao}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Garantia */}
      <div className="via-garantia">
        {config.termo_garantia ? (
          <p><strong>Garantia:</strong> {config.termo_garantia}</p>
        ) : (
          <p>Garantia do serviço: <strong>{os.garantia_dias} dias</strong>.</p>
        )}
        {config.politica_os && <p>{config.politica_os}</p>}
      </div>

      {/* Assinaturas */}
      <div className="via-assinaturas">
        {os.assinatura_cliente ? (
          <AssinaturaImg src={os.assinatura_cliente} label={`Assinatura do cliente${os.aprovado ? " (aprovado)" : ""}`} inteira={inteira} />
        ) : (
          <Assinatura label="Assinatura do cliente" />
        )}
        {os.assinatura_tecnico ? (
          <AssinaturaImg
            src={os.assinatura_tecnico}
            label={`Responsável técnico${os.tecnico ? ` — ${os.tecnico}` : ""}`}
            inteira={inteira}
          />
        ) : (
          <Assinatura label={`Responsável técnico${os.tecnico ? ` — ${os.tecnico}` : ""}`} />
        )}
      </div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="via-bloco">
      <div className="via-bloco-titulo">{titulo}</div>
      <div className="via-bloco-conteudo">{children}</div>
    </div>
  );
}

function CampoLinha({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="via-campo-linha">
      <span className="via-campo-titulo">{titulo}: </span>
      <span className="via-campo-valor">{valor}</span>
    </div>
  );
}

function LinhaTotal({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <tr>
      <td>{titulo}</td>
      <td>{valor}</td>
    </tr>
  );
}

function QrBox({ img, titulo, sub }: { img: string; titulo: string; sub: string }) {
  return (
    <div className="via-qr">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={titulo} />
      <div className="via-qr-titulo">{titulo}</div>
      <div className="via-qr-sub">{sub}</div>
    </div>
  );
}

function Assinatura({ label }: { label: string }) {
  return (
    <div className="via-assinatura">
      <div className="via-assinatura-linha">{label}</div>
    </div>
  );
}

function AssinaturaImg({ src, label, inteira }: { src: string; label: string; inteira?: boolean }) {
  return (
    <div className="via-assinatura">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="assinatura" className={inteira ? "via-assinatura-img--grande" : undefined} />
      <div className="via-assinatura-linha">{label}</div>
    </div>
  );
}

import { pixCopiaCola, PIX_CHAVE_CNPJ, GOOGLE_REVIEW_URL, formatPixCnpj } from "@/lib/pix";
import { qrImageUrl } from "@/lib/qrcode";
import { formatCurrency } from "@/lib/format";

export function PortalQrCodes({
  empresaNome,
  cidade,
  valorTotal,
  compact = false,
}: {
  empresaNome: string;
  cidade?: string;
  valorTotal?: number;
  compact?: boolean;
}) {
  const pixPayload = pixCopiaCola({
    nome: empresaNome,
    cidade,
    valor: valorTotal && valorTotal > 0 ? valorTotal : undefined,
  });
  const pixQr = qrImageUrl(pixPayload, compact ? 80 : 140);
  const googleQr = qrImageUrl(GOOGLE_REVIEW_URL, compact ? 80 : 140);

  if (compact) {
    return (
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <QrMini img={pixQr} titulo="PIX" sub={`CNPJ ${formatPixCnpj(PIX_CHAVE_CNPJ)}`} />
        <QrMini img={googleQr} titulo="Avalie" sub="Google" />
      </div>
    );
  }

  return (
    <div className="card mb-4 p-5 no-print">
      <h2 className="mb-4 font-semibold text-slate-900">Pagamento e avaliação</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pixQr} alt="QR Code PIX" className="h-36 w-36" />
          <p className="mt-3 font-semibold text-slate-900">Pague com PIX</p>
          <p className="mt-1 text-xs text-slate-500">Chave CNPJ</p>
          <p className="font-mono text-sm text-brand-700">{formatPixCnpj(PIX_CHAVE_CNPJ)}</p>
          {valorTotal != null && valorTotal > 0 && (
            <p className="mt-2 text-lg font-bold text-slate-900">{formatCurrency(valorTotal)}</p>
          )}
        </div>
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={googleQr} alt="QR Code Google" className="h-36 w-36" />
          <p className="mt-3 font-semibold text-slate-900">Avalie no Google</p>
          <p className="mt-1 text-xs text-slate-500">Sua opinião nos ajuda muito!</p>
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-sm text-brand-600 hover:underline"
          >
            Abrir link de avaliação
          </a>
        </div>
      </div>
    </div>
  );
}

function QrMini({ img, titulo, sub }: { img: string; titulo: string; sub: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img} alt={titulo} style={{ width: 52, height: 52 }} />
      <div style={{ fontSize: 7, fontWeight: 700, color: "#1d4ed8" }}>{titulo}</div>
      <div style={{ fontSize: 6, color: "#64748b", maxWidth: 58 }}>{sub}</div>
    </div>
  );
}

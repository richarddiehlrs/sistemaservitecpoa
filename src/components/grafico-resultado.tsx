import { formatCurrency } from "@/lib/format";

export type PontoResultado = {
  label: string;
  faturamento: number;
  gastos: number; // custos + despesas
  lucro: number;
  meta?: number | null;
  destaque?: boolean;
};

function abreviar(v: number): string {
  const a = Math.abs(v);
  if (a >= 1000) return `${v < 0 ? "-" : ""}${(a / 1000).toFixed(a >= 10000 ? 0 : 1).replace(".", ",")}k`;
  return String(Math.round(v));
}

/**
 * Barras de faturamento x gastos por mês, linha de lucro líquido e marca da meta.
 * SVG puro (renderiza no servidor, responsivo pelo viewBox).
 */
export function GraficoResultado({ dados }: { dados: PontoResultado[] }) {
  const W = 760;
  const H = 260;
  const m = { top: 16, right: 12, bottom: 28, left: 46 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const max = Math.max(1, ...dados.flatMap((d) => [d.faturamento, d.gastos, d.lucro, d.meta ?? 0]));
  const min = Math.min(0, ...dados.map((d) => d.lucro));
  const escala = (v: number) => m.top + ih - ((v - min) / (max - min)) * ih;
  const zero = escala(0);
  const slot = iw / Math.max(1, dados.length);
  const larg = Math.min(18, slot * 0.32);

  const ticks = Array.from({ length: 5 }).map((_, i) => min + ((max - min) * i) / 4);
  const linha = dados
    .map((d, i) => `${i === 0 ? "M" : "L"}${m.left + slot * i + slot / 2},${escala(d.lucro)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Faturamento, gastos e lucro por mês">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.left} x2={W - m.right} y1={escala(t)} y2={escala(t)} stroke="#e2e8f0" strokeDasharray={t === 0 ? "" : "3 3"} />
            <text x={m.left - 6} y={escala(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {abreviar(t)}
            </text>
          </g>
        ))}

        {dados.map((d, i) => {
          const x = m.left + slot * i + slot / 2;
          return (
            <g key={d.label}>
              {d.destaque && <rect x={x - slot / 2} y={m.top} width={slot} height={ih} fill="#eff6ff" />}
              <rect x={x - larg - 1} y={Math.min(escala(d.faturamento), zero)} width={larg} height={Math.abs(zero - escala(d.faturamento))} rx="2" fill="#16a34a">
                <title>{`${d.label} — faturamento ${formatCurrency(d.faturamento)}`}</title>
              </rect>
              <rect x={x + 1} y={Math.min(escala(d.gastos), zero)} width={larg} height={Math.abs(zero - escala(d.gastos))} rx="2" fill="#f87171">
                <title>{`${d.label} — custos e despesas ${formatCurrency(d.gastos)}`}</title>
              </rect>
              {d.meta ? (
                <line x1={x - larg - 4} x2={x + larg + 4} y1={escala(d.meta)} y2={escala(d.meta)} stroke="#a16207" strokeWidth="2" strokeDasharray="4 2">
                  <title>{`${d.label} — meta ${formatCurrency(d.meta)}`}</title>
                </line>
              ) : null}
              <text x={x} y={H - 10} textAnchor="middle" fontSize="10" fill={d.destaque ? "#1d4ed8" : "#64748b"} fontWeight={d.destaque ? 700 : 400}>
                {d.label}
              </text>
            </g>
          );
        })}

        <path d={linha} fill="none" stroke="#1d4ed8" strokeWidth="2.5" />
        {dados.map((d, i) => (
          <circle key={d.label} cx={m.left + slot * i + slot / 2} cy={escala(d.lucro)} r="3.5" fill={d.lucro >= 0 ? "#1d4ed8" : "#dc2626"}>
            <title>{`${d.label} — lucro líquido ${formatCurrency(d.lucro)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
        <Legenda cor="bg-green-600" texto="Faturamento" />
        <Legenda cor="bg-red-400" texto="Custos + despesas" />
        <Legenda cor="bg-brand-700" texto="Lucro líquido" linha />
        <Legenda cor="bg-yellow-700" texto="Meta" linha />
      </div>
    </div>
  );
}

function Legenda({ cor, texto, linha }: { cor: string; texto: string; linha?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`${cor} ${linha ? "h-0.5 w-4" : "h-2.5 w-2.5 rounded-sm"}`} />
      {texto}
    </span>
  );
}

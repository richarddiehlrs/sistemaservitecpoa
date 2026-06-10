import { formatCurrency } from "@/lib/format";

// Gráfico de barras mensal: receita x despesa (puro CSS, sem dependências)
export function MonthlyBars({
  data,
}: {
  data: { label: string; receita: number; despesa: number }[];
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.receita, d.despesa]));

  return (
    <div>
      <div className="flex h-56 items-end gap-3">
        {data.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-48 w-full items-end justify-center gap-1">
              <div
                className="w-1/2 rounded-t bg-green-500 transition-all"
                style={{ height: `${(d.receita / max) * 100}%` }}
                title={`Receita: ${formatCurrency(d.receita)}`}
              />
              <div
                className="w-1/2 rounded-t bg-red-400 transition-all"
                style={{ height: `${(d.despesa / max) * 100}%` }}
                title={`Despesa: ${formatCurrency(d.despesa)}`}
              />
            </div>
            <span className="text-xs text-slate-500">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-green-500" /> Receitas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-red-400" /> Despesas
        </span>
      </div>
    </div>
  );
}

// Lista de barras horizontais (ranking / distribuição)
export function HBarList({
  items,
  formatValue,
}: {
  items: { label: string; value: number; color?: string }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const fmt = formatValue || ((v: number) => String(v));

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Sem dados no período.</p>;
  }

  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-slate-600">{it.label}</span>
            <span className="font-medium text-slate-800">{fmt(it.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${it.color || "bg-brand-500"}`}
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

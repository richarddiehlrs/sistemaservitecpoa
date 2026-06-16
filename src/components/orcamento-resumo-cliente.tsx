import { Info } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { resumoOrcamentoCliente } from "@/lib/os-valores";
import { cn } from "@/lib/utils";

function Linha({
  titulo,
  valor,
  className,
  valorClassName,
}: {
  titulo: string;
  valor: string;
  className?: string;
  valorClassName?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span>{titulo}</span>
      <span className={cn("shrink-0 font-medium tabular-nums", valorClassName)}>{valor}</span>
    </div>
  );
}

export function OrcamentoResumoCliente({
  valor_itens,
  valor_visita,
  abater_visita,
  desconto = 0,
  acrescimo = 0,
  className,
  compact = false,
  mostrarExplicacao = true,
}: {
  valor_itens: number;
  valor_visita: number;
  abater_visita: boolean;
  desconto?: number;
  acrescimo?: number;
  className?: string;
  /** Impressão / layout mais enxuto */
  compact?: boolean;
  mostrarExplicacao?: boolean;
}) {
  const r = resumoOrcamentoCliente({
    valor_itens,
    valor_visita,
    abater_visita,
    desconto,
    acrescimo,
  });

  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <Linha titulo="Serviços + peças" valor={formatCurrency(r.valorItens)} />

      {r.acrescimo > 0 && (
        <Linha titulo="Acréscimo" valor={`+ ${formatCurrency(r.acrescimo)}`} />
      )}
      {r.desconto > 0 && (
        <Linha titulo="Desconto" valor={`- ${formatCurrency(r.desconto)}`} />
      )}

      {r.mostraAbatimentoVisita && (
        <>
          {!compact && (
            <Linha
              titulo="Subtotal do reparo"
              valor={formatCurrency(r.subtotalServicos)}
              className="border-t border-dashed border-slate-200 pt-2 text-slate-600"
            />
          )}
          <Linha
            titulo={r.visitaLinha.label}
            valor={`${r.visitaLinha.prefixo}${formatCurrency(r.visitaLinha.valor)}`}
            valorClassName="text-emerald-700"
            className={compact ? undefined : "font-medium text-emerald-800"}
          />
        </>
      )}

      {!r.mostraAbatimentoVisita && r.visitaLinha.valor > 0 && (
        <Linha
          titulo={r.visitaLinha.label}
          valor={`${r.visitaLinha.prefixo}${formatCurrency(r.visitaLinha.valor)}`}
        />
      )}

      {mostrarExplicacao && r.textoVisitaPaga && (
        <div className="mt-2 flex gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-xs leading-relaxed text-emerald-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="font-medium">{r.textoVisitaPaga}</p>
            <p className="mt-1 text-emerald-800/90">
              Valor já pago na visita: {formatCurrency(r.valorVisita)} • Restante do reparo:{" "}
              <strong>{formatCurrency(r.total)}</strong>
            </p>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex items-center justify-between border-t border-slate-200 pt-2",
          compact ? "pt-1" : "pt-3"
        )}
      >
        <span className={cn("font-semibold text-slate-900", !compact && "text-base")}>
          {r.labelTotal}
        </span>
        <span className={cn("font-bold text-brand-700 tabular-nums", !compact && "text-xl")}>
          {formatCurrency(r.total)}
        </span>
      </div>
    </div>
  );
}

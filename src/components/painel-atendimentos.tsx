"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Home, Wrench } from "lucide-react";
import { formatNumeroOS, STATUS_OS_LABEL } from "@/lib/format";
import {
  PAINEL_GRUPOS,
  corPainelStatus,
  OFICINA_GRID_LINHAS,
  OFICINA_GRID_COLS,
  TIPO_ATENDIMENTO_LABEL,
  type TipoAtendimento,
} from "@/lib/painel-atendimento";

export type OsPainel = {
  id: string;
  numero: number;
  status: string;
  tipo_atendimento: TipoAtendimento;
  tecnico: string | null;
  data_previsao: string | null;
  prioridade: string;
  cliente_nome: string;
};

function filtrar(lista: OsPainel[], busca: string) {
  const q = busca.trim().toLowerCase();
  if (!q) return lista;
  return lista.filter(
    (o) =>
      String(o.numero).includes(q) ||
      formatNumeroOS(o.numero).toLowerCase().includes(q) ||
      o.cliente_nome.toLowerCase().includes(q)
  );
}

export function PainelAtendimentos({ ordens }: { ordens: OsPainel[] }) {
  const [busca, setBusca] = useState("");

  const filtradas = useMemo(() => filtrar(ordens, busca), [ordens, busca]);
  const domicilio = filtradas.filter((o) => o.tipo_atendimento !== "oficina");
  const oficina = filtradas.filter((o) => o.tipo_atendimento === "oficina");

  const contagem = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of PAINEL_GRUPOS) map[g.key] = 0;
    for (const o of filtradas) {
      const g = PAINEL_GRUPOS.find((x) => x.statuses.includes(o.status as never));
      if (g) map[g.key] = (map[g.key] || 0) + 1;
    }
    return map;
  }, [filtradas]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Buscar nº OS ou cliente..."
            className="input pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <p className="text-sm text-slate-500">
          {filtradas.length} OS ativa(s) • {domicilio.length} domicílio • {oficina.length} oficina
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SecaoDomicilio ordens={domicilio} />
        <SecaoOficina ordens={oficina} />
      </div>

      <LegendaPainel contagem={contagem} total={filtradas.length} />
    </div>
  );
}

function SecaoDomicilio({ ordens }: { ordens: OsPainel[] }) {
  const colunas = PAINEL_GRUPOS.filter((g) =>
    ["analise", "orcamento", "roteiro", "peca", "ausente", "garantia"].includes(g.key)
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-brand-50 px-4 py-3">
        <Home className="h-5 w-5 text-brand-600" />
        <h2 className="font-semibold text-slate-900">{TIPO_ATENDIMENTO_LABEL.domicilio}</h2>
        <span className="badge bg-brand-100 text-brand-700">{ordens.length}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3" style={{ minHeight: 320 }}>
        {colunas.map((grupo) => {
          const itens = ordens.filter((o) => grupo.statuses.includes(o.status as never));
          return (
            <div
              key={grupo.key}
              className="flex w-[148px] shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50"
            >
              <div
                className="rounded-t-lg px-2 py-1.5 text-center text-[11px] font-bold"
                style={{ background: grupo.cor, color: grupo.texto }}
              >
                {grupo.label}
                <span className="ml-1 opacity-80">({itens.length})</span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-1.5">
                {itens.length === 0 && (
                  <p className="py-4 text-center text-[10px] text-slate-300">—</p>
                )}
                {itens.map((o) => (
                  <CardOs key={o.id} os={o} compact />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SecaoOficina({ ordens }: { ordens: OsPainel[] }) {
  const totalCelulas = OFICINA_GRID_LINHAS * OFICINA_GRID_COLS;
  const celulas: (OsPainel | null)[] = Array.from({ length: totalCelulas }, (_, i) => ordens[i] ?? null);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-3">
        <Wrench className="h-5 w-5 text-slate-600" />
        <h2 className="font-semibold text-slate-900">{TIPO_ATENDIMENTO_LABEL.oficina}</h2>
        <span className="badge bg-slate-200 text-slate-700">{ordens.length}</span>
      </div>
      <div className="overflow-x-auto p-3">
        <div
          className="inline-grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${OFICINA_GRID_COLS}, minmax(52px, 1fr))`,
            gridTemplateRows: `repeat(${OFICINA_GRID_LINHAS}, 44px)`,
            minWidth: OFICINA_GRID_COLS * 56,
          }}
        >
          {celulas.map((os, idx) => {
            const linha = Math.floor(idx / OFICINA_GRID_COLS) + 1;
            const col = (idx % OFICINA_GRID_COLS) + 1;
            if (!os) {
              return (
                <div
                  key={`vazio-${idx}`}
                  className="flex items-center justify-center rounded border border-dashed border-slate-200 bg-white text-[9px] text-slate-300"
                  title={`Posição ${String(linha).padStart(2, "0")}-${col}`}
                >
                  {String(linha).padStart(2, "0")}
                </div>
              );
            }
            const { cor, texto } = corPainelStatus(os.status);
            return (
              <Link
                key={os.id}
                href={`/ordens/${os.id}`}
                className="flex flex-col items-center justify-center rounded border border-black/10 px-0.5 text-center shadow-sm transition hover:scale-105 hover:shadow-md"
                style={{ background: cor, color: texto }}
                title={`${formatNumeroOS(os.numero)} — ${os.cliente_nome} — ${STATUS_OS_LABEL[os.status] || os.status}`}
              >
                <span className="text-[11px] font-bold leading-tight">{os.numero}</span>
                <span className="max-w-full truncate text-[8px] opacity-90">{os.cliente_nome.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </div>
      {ordens.length > totalCelulas && (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          + {ordens.length - totalCelulas} OS na oficina fora do grid — conclua ou entregue para liberar posição.
        </p>
      )}
    </div>
  );
}

function CardOs({ os, compact }: { os: OsPainel; compact?: boolean }) {
  const { cor, texto } = corPainelStatus(os.status);
  return (
    <Link
      href={`/ordens/${os.id}`}
      className={`block rounded border border-black/5 px-2 py-1.5 shadow-sm transition hover:shadow-md ${compact ? "" : ""}`}
      style={{ background: cor, color: texto }}
      title={STATUS_OS_LABEL[os.status] || os.status}
    >
      <div className="text-sm font-bold">{formatNumeroOS(os.numero)}</div>
      <div className="truncate text-[10px] opacity-90">{os.cliente_nome}</div>
      {os.tecnico && <div className="truncate text-[9px] opacity-75">{os.tecnico}</div>}
    </Link>
  );
}

function LegendaPainel({ contagem, total }: { contagem: Record<string, number>; total: number }) {
  return (
    <div className="card mt-4 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Legenda de status</h3>
        <span className="text-sm text-slate-500">Total no painel: <strong>{total}</strong></span>
      </div>
      <div className="flex flex-wrap gap-2">
        {PAINEL_GRUPOS.map((g) => (
          <div
            key={g.key}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium"
            style={{ background: g.cor, color: g.texto }}
          >
            {g.label}
            <span className="rounded bg-black/15 px-1.5 py-0.5 font-bold">{contagem[g.key] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

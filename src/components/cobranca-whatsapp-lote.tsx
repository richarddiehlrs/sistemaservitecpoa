"use client";

import { useState } from "react";
import { ChevronRight, MessageCircle, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { linkWhatsApp, mensagemCobranca, telefoneComDDI } from "@/lib/whatsapp";

export type CobrancaLoteItem = {
  id: string;
  telefone?: string | null;
  cliente?: string | null;
  descricao: string;
  valor: number;
  vencimento?: string | null;
};

export function CobrancaWhatsAppLote({
  items,
  empresa,
}: {
  items: CobrancaLoteItem[];
  empresa: string;
}) {
  const comTel = items.filter((i) => telefoneComDDI(i.telefone));
  const [aberto, setAberto] = useState(false);
  const [sequencia, setSequencia] = useState(0);

  if (comTel.length === 0) return null;

  const atual = comTel[sequencia];
  const hrefAtual = atual
    ? linkWhatsApp(
        atual.telefone,
        mensagemCobranca({
          cliente: atual.cliente,
          descricao: atual.descricao,
          valor: atual.valor,
          vencimento: atual.vencimento,
          empresa,
        })
      )
    : null;

  return (
    <>
      <button type="button" onClick={() => { setAberto(true); setSequencia(0); }} className="btn-secondary text-sm">
        <MessageCircle className="h-4 w-4" />
        Cobrar vencidos ({comTel.length})
      </button>

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <h3 className="font-semibold text-slate-900">Cobrança WhatsApp</h3>
                <p className="text-xs text-slate-500">
                  {comTel.length} cliente(s) com telefone • envie uma mensagem por vez
                </p>
              </div>
              <button type="button" onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {hrefAtual && atual && (
              <div className="border-b border-slate-100 bg-green-50/50 p-4">
                <p className="text-xs font-medium uppercase text-green-800">
                  {sequencia + 1} de {comTel.length}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{atual.cliente || "Cliente"}</p>
                <p className="text-sm text-slate-600">
                  {atual.descricao} — {formatCurrency(atual.valor)}
                  {atual.vencimento && (
                    <span className="text-red-600"> • venceu {formatDate(atual.vencimento)}</span>
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={hrefAtual}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary text-sm"
                  >
                    <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                  </a>
                  {sequencia < comTel.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => setSequencia((i) => i + 1)}
                      className="btn-secondary text-sm"
                    >
                      Próximo <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => setAberto(false)} className="btn-secondary text-sm">
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            )}

            <ul className="flex-1 overflow-y-auto p-2">
              {comTel.map((item, i) => {
                const href = linkWhatsApp(
                  item.telefone,
                  mensagemCobranca({
                    cliente: item.cliente,
                    descricao: item.descricao,
                    valor: item.valor,
                    vencimento: item.vencimento,
                    empresa,
                  })
                );
                return (
                  <li
                    key={item.id}
                    className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                      i === sequencia ? "bg-brand-50 ring-1 ring-brand-200" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-800">{item.cliente || "—"}</p>
                      <p className="truncate text-xs text-slate-500">
                        {formatCurrency(item.valor)} • {item.descricao}
                      </p>
                    </div>
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded p-1.5 text-green-600 hover:bg-green-50"
                        title="WhatsApp"
                        onClick={() => setSequencia(i)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

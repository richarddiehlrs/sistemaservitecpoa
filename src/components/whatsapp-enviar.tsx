"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, MessageCircle, RotateCcw, X } from "lucide-react";
import { linkWhatsApp, telefoneComDDI } from "@/lib/whatsapp";
import { formatTelefone } from "@/lib/format";

/** Mostra o texto do WhatsApp como o cliente vai ver (*negrito*, _itálico_, links). */
export function Previa({ texto }: { texto: string }) {
  const html = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(
      /(https?:\/\/[^\s<]+)/g,
      '<span class="text-sky-700 underline break-all">$1</span>',
    );
  return (
    <div className="rounded-lg bg-[#e7ddd4] p-3">
      <div
        className="ml-auto max-w-[95%] whitespace-pre-wrap break-words rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-slate-800 shadow-sm"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/**
 * Botão que abre uma prévia da mensagem (editável) antes de enviar pelo WhatsApp.
 * Evita mandar texto errado ao cliente e permite ajustar na hora.
 */
export function WhatsAppEnviar({
  telefone,
  mensagem,
  titulo,
  destinatario,
  className,
  children,
  desabilitadoMsg = "Cliente sem telefone válido",
}: {
  telefone?: string | null;
  mensagem: string;
  titulo: string;
  destinatario?: string | null;
  className?: string;
  children: React.ReactNode;
  desabilitadoMsg?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(mensagem);
  const [copiado, setCopiado] = useState(false);
  const temTelefone = Boolean(telefoneComDDI(telefone));

  useEffect(() => {
    if (aberto) setTexto(mensagem);
  }, [aberto, mensagem]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* navegador sem permissão de área de transferência */
    }
  }

  const href = linkWhatsApp(telefone, texto);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        disabled={!temTelefone}
        title={temTelefone ? titulo : desabilitadoMsg}
        className={`${className ?? ""} ${temTelefone ? "" : "cursor-not-allowed opacity-50"}`}
      >
        {children}
      </button>

      {aberto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
            onClick={() => setAberto(false)}
          >
            <div
              className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{titulo}</h3>
                  <p className="text-xs text-slate-500">
                    Para {destinatario ? `${destinatario} • ` : ""}
                    {formatTelefone(telefone ?? "")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAberto(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <Previa texto={texto} />
                <details className="text-sm">
                  <summary className="cursor-pointer text-xs font-medium text-brand-700">
                    Editar mensagem
                  </summary>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={12}
                    className="input mt-2 font-mono text-xs"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                    <span>*texto* = negrito • _texto_ = itálico</span>
                    <button
                      type="button"
                      onClick={() => setTexto(mensagem)}
                      className="inline-flex items-center gap-1 hover:text-slate-600"
                    >
                      <RotateCcw className="h-3 w-3" /> Restaurar
                    </button>
                  </div>
                </details>
              </div>

              <div className="flex gap-2 border-t border-slate-200 p-3">
                <button
                  type="button"
                  onClick={copiar}
                  className="btn-secondary flex-1"
                >
                  {copiado ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {copiado ? "Copiado" : "Copiar texto"}
                </button>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setAberto(false)}
                    className="btn flex-1 bg-green-600 text-white hover:bg-green-700"
                  >
                    <MessageCircle className="h-4 w-4" /> Abrir no WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

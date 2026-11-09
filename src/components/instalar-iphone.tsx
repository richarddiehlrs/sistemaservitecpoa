"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";

const CHAVE = "servitec-guia-iphone-fechado";

/**
 * No iPhone (Safari), mostra como instalar o sistema na Tela de Início.
 * Instalado, ele abre em tela cheia como app e pode receber notificações (iOS 16.4+).
 */
export function InstalarIphone() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    const instalado =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    let fechado = false;
    try {
      fechado = localStorage.getItem(CHAVE) === "1";
    } catch {
      /* modo privado */
    }
    setMostrar(ios && !instalado && !fechado);
  }, []);

  if (!mostrar) return null;

  return (
    <div className="relative rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
      <button
        type="button"
        className="absolute right-2 top-2 text-brand-400"
        onClick={() => {
          try {
            localStorage.setItem(CHAVE, "1");
          } catch {
            /* ignora */
          }
          setMostrar(false);
        }}
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="font-semibold">Use como app no iPhone</p>
      <ol className="mt-2 space-y-1.5">
        <li className="flex items-center gap-2">
          1. Toque em <Share className="h-4 w-4" /> <strong>Compartilhar</strong> (barra do Safari)
        </li>
        <li className="flex items-center gap-2">
          2. Escolha <SquarePlus className="h-4 w-4" /> <strong>Adicionar à Tela de Início</strong>
        </li>
        <li>3. Abra pelo ícone “ServitecPoa” e ative as notificações</li>
      </ol>
      <p className="mt-2 text-xs text-brand-700">Funciona mesmo sem sinal: despesas ficam salvas e são enviadas depois.</p>
    </div>
  );
}

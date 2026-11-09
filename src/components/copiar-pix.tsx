"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Botão "Copiar código PIX" — para o cliente colar no app do banco (PIX copia e cola). */
export function CopiarPix({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
    } catch {
      // Navegadores antigos: seleciona o texto para o cliente copiar manualmente
      const el = document.getElementById("pix-copia-cola") as HTMLTextAreaElement | null;
      el?.select();
      document.execCommand?.("copy");
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="mt-3 w-full">
      <button type="button" onClick={copiar} className="btn-primary w-full">
        {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copiado ? "Código copiado!" : "Copiar código PIX"}
      </button>
      <p className="mt-1 text-[11px] text-slate-500">Abra o app do seu banco → PIX → Pix copia e cola.</p>
      <textarea id="pix-copia-cola" readOnly value={codigo} rows={3} className="sr-only" aria-hidden />
    </div>
  );
}

"use client";

import { useEffect } from "react";

/** Abre a impressão da etiqueta ao criar OS de oficina (?etiqueta=1). */
export function OsEtiquetaPrompt({ osId }: { osId: string }) {
  useEffect(() => {
    const opened = sessionStorage.getItem(`etiqueta-os-${osId}`);
    if (opened) return;
    sessionStorage.setItem(`etiqueta-os-${osId}`, "1");
    window.open(`/imprimir/etiqueta-os/${osId}?auto=1`, "_blank", "noopener,noreferrer");
  }, [osId]);

  return null;
}

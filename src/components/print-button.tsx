"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    document.body.classList.add("modo-impressao");
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
    return () => document.body.classList.remove("modo-impressao");
  }, [auto]);

  return (
    <div className="no-print fixed right-4 top-4 z-50 flex gap-2">
      <button onClick={() => window.print()} className="btn-primary shadow-lg">
        <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
      </button>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

export function PrintButton({ auto = false, href }: { auto?: boolean; href?: string }) {
  useEffect(() => {
    if (href) return;
    document.body.classList.add("modo-impressao");
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => {
        clearTimeout(t);
        document.body.classList.remove("modo-impressao");
      };
    }
    return () => document.body.classList.remove("modo-impressao");
  }, [auto, href]);

  return (
    <div className="no-print fixed right-4 top-4 z-50 flex gap-2">
      {href ? (
        <Link href={href} target="_blank" className="btn-primary shadow-lg">
          <Printer className="h-4 w-4" /> Imprimir OS
        </Link>
      ) : (
        <button onClick={() => window.print()} className="btn-primary shadow-lg">
          <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
        </button>
      )}
    </div>
  );
}

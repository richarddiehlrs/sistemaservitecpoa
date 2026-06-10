"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Printer } from "lucide-react";

export function PrintButton({
  auto = false,
  href,
  bodyClass = "modo-impressao",
}: {
  auto?: boolean;
  href?: string;
  bodyClass?: string;
}) {
  useEffect(() => {
    if (href) return;
    document.body.classList.add(bodyClass);
    if (auto) {
      const t = setTimeout(() => window.print(), 600);
      return () => {
        clearTimeout(t);
        document.body.classList.remove(bodyClass);
      };
    }
    return () => document.body.classList.remove(bodyClass);
  }, [auto, href, bodyClass]);

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

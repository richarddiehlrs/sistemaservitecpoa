"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input readOnly value={url} className="input flex-1 text-xs" onFocus={(e) => e.target.select()} />
      <button onClick={copiar} className="btn-secondary shrink-0 px-2" title="Copiar link">
        {copiado ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}

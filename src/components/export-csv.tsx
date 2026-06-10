"use client";

import { Download } from "lucide-react";

export function ExportCsv({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}) {
  function download() {
    const sep = ";"; // separador padrão do Excel pt-BR
    const esc = (v: string | number | null | undefined) => {
      const s = String(v ?? "");
      return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [headers.join(sep), ...rows.map((r) => r.map(esc).join(sep))];
    const conteudo = "\uFEFF" + linhas.join("\r\n"); // BOM p/ acentos no Excel
    const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={download} className="btn-secondary" disabled={rows.length === 0} title="Exportar para Excel/CSV">
      <Download className="h-4 w-4" /> Exportar
    </button>
  );
}

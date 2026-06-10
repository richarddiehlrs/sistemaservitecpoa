/** UUID v4 da ordem de serviço. */
export const OS_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReferenciaOs =
  | { tipo: "id"; valor: string }
  | { tipo: "numero"; valor: number };

/** URL interna do ERP para abrir a OS (conteúdo do QR da etiqueta). */
export function urlAbrirOs(id: string, siteUrl?: string): string {
  const base =
    siteUrl?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return base ? `${base}/ordens/${id}` : `/ordens/${id}`;
}

/** Extrai ID ou número da OS a partir de QR, URL ou texto digitado. */
export function extrairReferenciaOs(texto: string): ReferenciaOs | null {
  const t = texto.trim();
  if (!t) return null;

  try {
    const url = new URL(t);
    const m = url.pathname.match(/\/ordens\/([0-9a-f-]{36})/i);
    if (m) return { tipo: "id", valor: m[1] };
  } catch {
    /* não é URL absoluta */
  }

  const pathMatch = t.match(/\/ordens\/([0-9a-f-]{36})/i);
  if (pathMatch) return { tipo: "id", valor: pathMatch[1] };

  if (OS_UUID_RE.test(t)) return { tipo: "id", valor: t };

  const osNum = t.match(/OS[-\s#]?(\d{1,6})/i);
  if (osNum) return { tipo: "numero", valor: parseInt(osNum[1], 10) };

  if (/^\d{1,6}$/.test(t)) return { tipo: "numero", valor: parseInt(t, 10) };

  return null;
}

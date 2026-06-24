/** Caminho interno seguro pós-login (bloqueia open redirect). */
export function safeRedirectPath(path: string | null | undefined, fallback = "/dashboard"): string {
  const p = String(path ?? "").trim();
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("://") || p.includes("\\")) {
    return fallback;
  }
  return p;
}

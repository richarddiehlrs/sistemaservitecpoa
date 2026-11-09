export const runtime = "edge";

import { iconeApp } from "@/lib/icone-app";

const PERMITIDOS = new Set([192, 512]);

export async function GET(_req: Request, { params }: { params: { tamanho: string } }) {
  const n = Number(params.tamanho);
  const tamanho = PERMITIDOS.has(n) ? n : 192;
  const res = iconeApp(tamanho, false);
  res.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return res;
}

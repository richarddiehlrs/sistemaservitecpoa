import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { homePorPapel, podeAcessarRota, type Papel } from "@/lib/permissoes";

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/os",
  "/imprimir/portal",
  // Arquivos do app instalável (iPhone busca sem sessão): sem dados
  "/manifest.webmanifest",
  "/sw.js",
  "/apple-icon",
  "/icone/",
];
const APP_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/ordens",
  "/painel",
  "/escanear",
  "/clientes",
  "/campo",
  "/financeiro",
  "/relatorios",
  "/resultados",
  "/dre",
  "/catalogo",
  "/usuarios",
  "/configuracoes",
  "/manutencao",
];

export async function middleware(request: NextRequest) {
  return await updateSession(request, {
    publicPaths: PUBLIC_PATHS,
    guardAppRoutes: (pathname, papel) => {
      const isApp = APP_PREFIXES.some((p) => pathname.startsWith(p));
      if (!isApp) return true;
      return podeAcessarRota(papel, pathname);
    },
    homePorPapel: (p) => homePorPapel(p as Papel),
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

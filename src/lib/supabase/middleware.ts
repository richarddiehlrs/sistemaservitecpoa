import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import type { Papel } from "@/lib/permissoes";

const DEFAULT_PUBLIC_PATHS = ["/login", "/auth", "/os", "/imprimir/portal"];

type SessionOpts = {
  publicPaths?: string[];
  guardAppRoutes?: (pathname: string, papel: Papel) => boolean;
  homePorPapel?: (papel: Papel) => string;
};

export async function updateSession(request: NextRequest, opts: SessionOpts = {}) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const publicPaths = opts.publicPaths ?? DEFAULT_PUBLIC_PATHS;
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  // Cron Vercel: Bearer CRON_SECRET (sem sessão Supabase)
  if (pathname.startsWith("/api/cron/")) {
    const secret = process.env.CRON_SECRET;
    const auth = request.headers.get("authorization");
    if (secret && auth === `Bearer ${secret}`) {
      return supabaseResponse;
    }
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("papel, ativo")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.ativo && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("erro", "conta_inativa");
      return NextResponse.redirect(url);
    }

    const papel = (profile?.papel ?? "tecnico") as Papel;

    if (pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = opts.homePorPapel?.(papel) ?? (papel === "tecnico" ? "/campo" : "/dashboard");
      return NextResponse.redirect(url);
    }

    if (!isPublic && opts.guardAppRoutes && !opts.guardAppRoutes(pathname, papel)) {
      const url = request.nextUrl.clone();
      url.pathname = opts.homePorPapel?.(papel) ?? (papel === "tecnico" ? "/campo" : "/dashboard");
      url.searchParams.set("erro", "sem_permissao");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

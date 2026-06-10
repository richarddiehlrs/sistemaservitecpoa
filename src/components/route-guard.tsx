"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { homePorPapel, podeAcessarRota, type Papel } from "@/lib/permissoes";

export function RouteGuard({ role }: { role: Papel }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!podeAcessarRota(role, pathname)) {
      router.replace(`${homePorPapel(role)}?erro=sem_permissao`);
    }
  }, [pathname, role, router]);

  useEffect(() => {
    if (searchParams.get("erro") === "sem_permissao") {
      // toast via evento global
      window.dispatchEvent(
        new CustomEvent("app-toast", {
          detail: { msg: "Você não tem permissão para acessar esta área.", tipo: "error" },
        })
      );
    }
  }, [searchParams]);

  return null;
}

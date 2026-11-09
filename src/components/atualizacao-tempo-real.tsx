"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABELAS = ["ordens_servico", "os_etapas", "os_pagamentos", "lancamentos_financeiros", "agendamentos"] as const;

/**
 * Atualiza a tela sozinha quando algo muda no banco (outro usuário, o celular
 * do técnico, o portal do cliente). Agrupa várias mudanças seguidas num único
 * recarregamento e espera a aba voltar a ficar visível.
 */
export function AtualizacaoTempoReal() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const agendar = () => {
      if (document.visibilityState !== "visible") {
        pendente.current = true;
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 1200);
    };

    let canal = supabase.channel("operacao-tempo-real");
    for (const t of TABELAS) {
      canal = canal.on("postgres_changes", { event: "*", schema: "public", table: t }, agendar);
    }
    canal.subscribe();

    const aoVoltar = () => {
      if (document.visibilityState === "visible" && pendente.current) {
        pendente.current = false;
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", aoVoltar);
      supabase.removeChannel(canal);
    };
  }, [router]);

  return null;
}

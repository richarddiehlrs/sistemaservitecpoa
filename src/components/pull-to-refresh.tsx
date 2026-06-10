"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const active = useRef(false);

  const atualizar = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    router.refresh();
    await new Promise((r) => setTimeout(r, 600));
    setRefreshing(false);
    setPull(0);
  }, [router, refreshing]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 8 || refreshing) return;
    startY.current = e.touches[0].clientY;
    active.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!active.current || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY <= 8) {
      setPull(Math.min(dy * 0.5, 90));
    }
  };

  const onTouchEnd = () => {
    if (!active.current) return;
    active.current = false;
    if (pull >= THRESHOLD) {
      void atualizar();
    } else {
      setPull(0);
    }
  };

  const mostrarIndicador = pull > 8 || refreshing;

  return (
    <div className="relative" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden text-sm text-slate-500 transition-all duration-200"
        style={{ height: mostrarIndicador ? (refreshing ? 40 : pull) : 0 }}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Atualizando..." : pull >= THRESHOLD ? "Solte para atualizar" : "Puxe para atualizar"}
      </div>

      <button
        type="button"
        onClick={() => void atualizar()}
        disabled={refreshing}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition hover:bg-brand-700 disabled:opacity-60 md:bottom-6"
        aria-label="Atualizar página"
        title="Atualizar"
      >
        <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
      </button>

      {children}
    </div>
  );
}

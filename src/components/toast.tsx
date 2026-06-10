"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTipo = "success" | "error" | "info";
type Toast = { id: number; tipo: ToastTipo; msg: string };

type ToastCtx = { push: (msg: string, tipo?: ToastTipo) => void };

const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(Ctx);
  return (
    ctx ?? {
      // fallback: dispara evento global (caso usado fora do provider)
      push: (msg: string, tipo: ToastTipo = "info") => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("app-toast", { detail: { msg, tipo } }));
        }
      },
    }
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((msg: string, tipo: ToastTipo = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    function onEvt(e: Event) {
      const d = (e as CustomEvent).detail as { msg: string; tipo?: ToastTipo };
      if (d?.msg) push(d.msg, d.tipo || "info");
    }
    window.addEventListener("app-toast", onEvt);
    return () => window.removeEventListener("app-toast", onEvt);
  }, [push]);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => setToasts((arr) => arr.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const cfg = {
    success: { icon: CheckCircle2, cls: "border-green-200 bg-green-50 text-green-800", ic: "text-green-600" },
    error: { icon: AlertTriangle, cls: "border-red-200 bg-red-50 text-red-800", ic: "text-red-600" },
    info: { icon: Info, cls: "border-slate-200 bg-white text-slate-800", ic: "text-brand-600" },
  }[toast.tipo];
  const Icon = cfg.icon;
  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-card-hover animate-fade-in-up",
        cfg.cls
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", cfg.ic)} />
      <p className="flex-1 text-sm font-medium">{toast.msg}</p>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

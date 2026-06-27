"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { obterPosicaoGps } from "@/lib/geo";
import { useToast } from "@/components/toast";
import { CheckoutModal } from "@/components/checkout-modal";
import type { OsResumoCheckout } from "@/lib/os-valores";
import type { ActionResult } from "@/lib/action-result";

export function CheckinButtons({
  agendamento,
  checkinAction,
  checkoutAction,
  permitirRetorno = false,
  osResumo = null,
}: {
  agendamento: { status: string; checkin_at: string | null; checkout_at: string | null };
  checkinAction: (formData: FormData) => Promise<ActionResult>;
  checkoutAction: (formData: FormData) => Promise<ActionResult>;
  permitirRetorno?: boolean;
  osResumo?: OsResumoCheckout | null;
}) {
  const [pending, start] = useTransition();
  const [modalCheckout, setModalCheckout] = useState(false);
  const router = useRouter();
  const toast = useToast();

  if (agendamento.status === "cancelado" || agendamento.status === "realizado") return null;

  const podeCheckin = !agendamento.checkin_at;
  const podeCheckout = !!agendamento.checkin_at && !agendamento.checkout_at;
  if (!podeCheckin && !podeCheckout) return null;

  async function comGps(fn: (formData: FormData) => Promise<ActionResult>) {
    const fd = new FormData();
    try {
      const pos = await obterPosicaoGps();
      fd.set("lat", String(pos.lat));
      fd.set("lng", String(pos.lng));
      fd.set("precisao", String(pos.precisao));
    } catch {
      // check-in/out segue sem GPS se o usuário negar permissão
    }
    const res = await fn(fd);
    if (!res.ok) {
      toast.push(res.error || "Erro ao registrar check-in/out.", "error");
      return;
    }
    router.refresh();
  }

  function executar(fn: (formData: FormData) => Promise<ActionResult>) {
    start(async () => {
      await comGps(fn);
    });
  }

  return (
    <>
      <div className="flex shrink-0 gap-1">
        {podeCheckin && (
          <button
            type="button"
            disabled={pending}
            onClick={() => executar(checkinAction)}
            className="btn-primary px-2 py-1.5 text-xs"
            title="Check-in com localização GPS"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
            Check-in
          </button>
        )}
        {podeCheckout && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setModalCheckout(true)}
            className="btn-secondary px-2 py-1.5 text-xs"
            title="Check-out — informar resultado da visita"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            Check-out
          </button>
        )}
      </div>

      <CheckoutModal
        open={modalCheckout}
        onClose={() => setModalCheckout(false)}
        onConfirm={async (fd) => {
          const res = await checkoutAction(fd);
          if (res.ok) router.refresh();
          return res;
        }}
        pending={pending}
        permitirRetorno={permitirRetorno}
        osResumo={osResumo}
      />
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { obterPosicaoGps } from "@/lib/geo";
import { CheckoutModal } from "@/components/checkout-modal";

export function CheckinButtons({
  agendamento,
  checkinAction,
  checkoutAction,
  permitirRetorno = false,
}: {
  agendamento: { status: string; checkin_at: string | null; checkout_at: string | null };
  checkinAction: (formData: FormData) => Promise<void>;
  checkoutAction: (formData: FormData) => Promise<void>;
  permitirRetorno?: boolean;
}) {
  const [pending, start] = useTransition();
  const [modalCheckout, setModalCheckout] = useState(false);
  const router = useRouter();

  if (agendamento.status === "cancelado" || agendamento.status === "realizado") return null;

  const podeCheckin = !agendamento.checkin_at;
  const podeCheckout = !!agendamento.checkin_at && !agendamento.checkout_at;
  if (!podeCheckin && !podeCheckout) return null;

  async function comGps(fn: (formData: FormData) => Promise<void>) {
    const fd = new FormData();
    try {
      const pos = await obterPosicaoGps();
      fd.set("lat", String(pos.lat));
      fd.set("lng", String(pos.lng));
      fd.set("precisao", String(pos.precisao));
    } catch {
      // check-in/out segue sem GPS se o usuário negar permissão
    }
    await fn(fd);
    router.refresh();
  }

  function executar(fn: (formData: FormData) => Promise<void>) {
    start(() => comGps(fn));
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
          await checkoutAction(fd);
          router.refresh();
        }}
        pending={pending}
        permitirRetorno={permitirRetorno}
      />
    </>
  );
}

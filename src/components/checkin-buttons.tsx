"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, Loader2 } from "lucide-react";

export function CheckinButtons({
  agendamento,
  checkinAction,
  checkoutAction,
}: {
  agendamento: { status: string; checkin_at: string | null; checkout_at: string | null };
  checkinAction: () => Promise<void>;
  checkoutAction: () => Promise<void>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  if (agendamento.status === "cancelado" || agendamento.status === "realizado") return null;

  const podeCheckin = !agendamento.checkin_at;
  const podeCheckout = !!agendamento.checkin_at && !agendamento.checkout_at;
  if (!podeCheckin && !podeCheckout) return null;

  function executar(fn: () => Promise<void>) {
    start(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div className="flex shrink-0 gap-1">
      {podeCheckin && (
        <button
          type="button"
          disabled={pending}
          onClick={() => executar(checkinAction)}
          className="btn-primary px-2 py-1.5 text-xs"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
          Check-in
        </button>
      )}
      {podeCheckout && (
        <button
          type="button"
          disabled={pending}
          onClick={() => executar(checkoutAction)}
          className="btn-secondary px-2 py-1.5 text-xs"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Check-out
        </button>
      )}
    </div>
  );
}

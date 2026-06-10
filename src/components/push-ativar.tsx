"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { registrarPushSubscription, removerPushSubscription } from "@/app/(app)/campo/push-actions";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function PushAtivar() {
  const [suportado, setSuportado] = useState(false);
  const [ativo, setAtivo] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  const verificar = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !vapidKey) {
      setSuportado(false);
      return;
    }
    setSuportado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setAtivo(!!sub);
    } catch {
      setAtivo(false);
    }
  }, [vapidKey]);

  useEffect(() => {
    verificar();
  }, [verificar]);

  async function ativar() {
    if (!vapidKey) {
      setErro("Push não configurado no servidor (chaves VAPID).");
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setErro("Permissão de notificação negada.");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }

      const json = sub.toJSON();
      const fd = new FormData();
      fd.set("endpoint", json.endpoint || "");
      fd.set("p256dh", json.keys?.p256dh || "");
      fd.set("auth", json.keys?.auth || "");
      await registrarPushSubscription(fd);
      setAtivo(true);
    } catch (e) {
      setErro((e as Error).message || "Não foi possível ativar notificações.");
    } finally {
      setCarregando(false);
    }
  }

  async function desativar() {
    setCarregando(true);
    setErro(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removerPushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setAtivo(false);
    } catch (e) {
      setErro((e as Error).message || "Erro ao desativar.");
    } finally {
      setCarregando(false);
    }
  }

  if (!suportado && !vapidKey) return null;

  return (
    <div className="card mb-6 border-brand-200 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 font-semibold text-brand-900">
            <Bell className="h-4 w-4" />
            Notificações no celular
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Receba avisos no celular: nova OS, aprovação de orçamento, cliente ausente e mais.
          </p>
          {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
          {!vapidKey && (
            <p className="mt-1 text-xs text-amber-700">
              Configure as chaves VAPID no servidor para ativar push.
            </p>
          )}
        </div>
        {vapidKey && (
          <button
            type="button"
            onClick={ativo ? desativar : ativar}
            disabled={carregando || !suportado}
            className={ativo ? "btn-secondary" : "btn-primary"}
          >
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : ativo ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
            {ativo ? "Desativar" : "Ativar notificações"}
          </button>
        )}
      </div>
    </div>
  );
}

import webpush from "web-push";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key);
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function vapidConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function configurarVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

export async function enviarPushParaUsuario(userId: string, payload: PushPayload) {
  if (!vapidConfigurado()) return { enviados: 0, erros: 0 };

  const supabase = supabaseAdmin();
  if (!supabase) return { enviados: 0, erros: 0 };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return { enviados: 0, erros: 0 };

  configurarVapid();
  const body = JSON.stringify(payload);
  let enviados = 0;
  let erros = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body
      );
      enviados++;
    } catch (err: unknown) {
      erros++;
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return { enviados, erros };
}

/** @deprecated Use notificarOsNova de @/lib/notificacoes */
export async function notificarTecnicoNovaOs(opts: {
  tecnicoId: string;
  osId: string;
  numero: number;
  clienteNome?: string | null;
  dataVisita?: string | null;
}) {
  const { notificarOsNova } = await import("@/lib/notificacoes");
  return notificarOsNova(opts);
}

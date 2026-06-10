import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { STATUS_OS_ATRASO, hojeYmd } from "@/lib/alertas";
import type { Database } from "@/types/database";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key);
}

async function enviarEmail(destino: string, assunto: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "ServitecPoa <noreply@servitecpoa.com.br>";
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [destino], subject: assunto, html }),
  });
  return res.ok;
}

export async function enviarResumosDiarios() {
  const supabase = supabaseAdmin();
  if (!supabase) return { enviados: 0, erros: 0 };

  const hoje = hojeYmd();

  const { data: prefs } = await supabase
    .from("preferencias_alertas")
    .select("user_id")
    .eq("email_resumo", true);

  if (!prefs?.length) return { enviados: 0, erros: 0 };

  const userIds = prefs.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, nome")
    .in("id", userIds)
    .eq("ativo", true);

  if (!profiles?.length) return { enviados: 0, erros: 0 };

  const [{ count: osAtrasadas }, { count: aguardandoAprovacao }, { count: despesasCampo }] =
    await Promise.all([
      supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .in("status", [...STATUS_OS_ATRASO])
        .lt("data_previsao", hoje)
        .not("data_previsao", "is", null),
      supabase
        .from("ordens_servico")
        .select("id", { count: "exact", head: true })
        .eq("status", "aguardando_aprovacao"),
      supabase
        .from("lancamentos_financeiros")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "despesa")
        .eq("origem", "campo")
        .eq("status", "pendente"),
    ]);

  let enviados = 0;
  let erros = 0;

  for (const profile of profiles) {
    if (!profile.email) continue;

    const linhas: string[] = [];
    if ((osAtrasadas ?? 0) > 0) linhas.push(`<li>${osAtrasadas} OS com visita atrasada</li>`);
    if ((aguardandoAprovacao ?? 0) > 0)
      linhas.push(`<li>${aguardandoAprovacao} orçamentos aguardando aprovação</li>`);
    if ((despesasCampo ?? 0) > 0)
      linhas.push(`<li>${despesasCampo} despesas de campo pendentes</li>`);

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
    const html = `
      <h2>Resumo ServitecPoa — ${new Date().toLocaleDateString("pt-BR")}</h2>
      <p>Olá ${profile.nome || ""},</p>
      ${
        linhas.length
          ? `<ul>${linhas.join("")}</ul>`
          : "<p>Tudo em dia hoje. Nenhum alerta crítico.</p>"
      }
      ${siteUrl ? `<p><a href="${siteUrl}/dashboard">Abrir o ERP</a></p>` : ""}
      <p style="color:#64748b;font-size:12px">Você recebe este e-mail porque ativou o resumo diário em Configurações → Alertas.</p>
    `;

    const ok = await enviarEmail(profile.email, "Resumo diário — ServitecPoa", html);
    if (ok) enviados++;
    else erros++;
  }

  return { enviados, erros };
}

import { NextResponse } from "next/server";
import { enviarResumosDiarios } from "@/lib/email-resumo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  const resultado = await enviarResumosDiarios();
  return NextResponse.json({ ok: true, ...resultado });
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { notificarAprovacaoPortal } from "@/app/os/notificar-actions";

export function OsAprovar({ token }: { token: string }) {
  const router = useRouter();
  const supabase = createClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvasRef.current!.width,
      y: ((e.clientY - rect.top) / rect.height) * canvasRef.current!.height,
    };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    desenhando.current = true;
    setTemTraco(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function end() {
    desenhando.current = false;
  }
  function limpar() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setTemTraco(false);
  }

  async function aprovar() {
    setEnviando(true);
    setErro(null);
    const assinatura = temTraco ? canvasRef.current!.toDataURL("image/png") : null;
    const { data, error } = await supabase.rpc("os_aprovar", {
      p_token: token,
      p_assinatura: assinatura,
      p_obs: obs || null,
    });
    setEnviando(false);
    if (error || (data && (data as any).ok === false)) {
      setErro("Não foi possível aprovar. Tente novamente ou entre em contato.");
      return;
    }
    try {
      await notificarAprovacaoPortal(token);
    } catch (err) {
      console.error("[os-aprovar] Falha ao notificar aprovação:", err);
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Para aprovar o orçamento, assine no quadro abaixo (opcional) e confirme.
      </p>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-lg border border-slate-300 bg-white"
        style={{ aspectRatio: "400 / 150" }}
      />
      <div className="flex items-center gap-2">
        <button onClick={limpar} className="btn-secondary text-sm">
          <Eraser className="h-4 w-4" /> Limpar
        </button>
      </div>
      <textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observação (opcional)"
        rows={2}
        className="input"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button onClick={aprovar} disabled={enviando} className="btn-primary w-full">
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Aprovar orçamento
      </button>
    </div>
  );
}

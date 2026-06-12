"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Check, Loader2 } from "lucide-react";
import { aprovarOrcamentoPortal } from "@/app/os/portal-actions";

export function OsAprovar({ token }: { token: string }) {
  const router = useRouter();
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

    const result = await aprovarOrcamentoPortal(token, assinatura, obs || null);

    setEnviando(false);
    if (!result.ok) {
      setErro(result.erro);
      return;
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
        height={120}
        className="w-full touch-none rounded-lg border border-slate-200 bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={limpar}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
        >
          <Eraser className="h-4 w-4" />
          Limpar
        </button>
      </div>
      <textarea
        value={obs}
        onChange={(e) => setObs(e.target.value)}
        placeholder="Observação (opcional)"
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="button"
        onClick={aprovar}
        disabled={enviando}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Aprovar orçamento
      </button>
    </div>
  );
}

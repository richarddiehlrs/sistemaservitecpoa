"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eraser, Check, Loader2 } from "lucide-react";
import { salvarAssinaturaTecnico } from "@/app/(app)/ordens/actions";
import { useToast } from "./toast";

export function OsAssinaturaTecnico({
  osId,
  assinaturaAtual,
  somenteLeitura = false,
}: {
  osId: string;
  assinaturaAtual?: string | null;
  somenteLeitura?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || somenteLeitura) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, [somenteLeitura]);

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
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
    setSalvo(false);
  }

  function salvar() {
    const dataUrl = canvasRef.current!.toDataURL("image/png");
    setSalvo(false);
    startTransition(async () => {
      const res = await salvarAssinaturaTecnico(osId, dataUrl);
      if (!res.ok) {
        toast.push(res.error, "error");
        return;
      }
      setSalvo(true);
    });
  }

  if (somenteLeitura) {
    if (!assinaturaAtual) {
      return <p className="text-sm text-amber-600">Aguardando assinatura do técnico responsável.</p>;
    }
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assinaturaAtual} alt="Assinatura técnico" className="h-16 object-contain" />
        <p className="text-xs text-green-700">Assinatura do técnico registrada.</p>
      </div>
    );
  }

  return (
    <div>
      {assinaturaAtual && !temTraco && (
        <div className="mb-2 rounded-lg border border-green-200 bg-green-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assinaturaAtual} alt="Assinatura técnico" className="h-16 object-contain" />
          <p className="text-xs text-green-700">Assinatura registrada. Desenhe abaixo para substituir.</p>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={360}
        height={140}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full touch-none rounded-lg border border-slate-300 bg-white"
        style={{ aspectRatio: "360 / 140" }}
      />
      <div className="mt-2 flex items-center gap-2">
        <button type="button" onClick={limpar} className="btn-secondary text-sm">
          <Eraser className="h-4 w-4" /> Limpar
        </button>
        <button type="button" onClick={salvar} disabled={!temTraco || pending} className="btn-primary text-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar assinatura
        </button>
        {salvo && <span className="text-sm text-green-600">Salvo!</span>}
      </div>
    </div>
  );
}

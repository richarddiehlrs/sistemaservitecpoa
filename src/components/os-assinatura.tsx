"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eraser, Check, Loader2, FileCheck } from "lucide-react";
import { salvarAssinatura, aprovarOrcamentoComAssinatura } from "@/app/(app)/ordens/actions";

export function OsAssinatura({
  osId,
  assinaturaAtual,
  podeAprovar = false,
  aprovado = false,
}: {
  osId: string;
  assinaturaAtual?: string | null;
  podeAprovar?: boolean;
  aprovado?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);
  const [obs, setObs] = useState("");
  const [pending, startTransition] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const [aprovadoOk, setAprovadoOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

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
    setErro(null);
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
    setAprovadoOk(false);
    setErro(null);
  }

  function assinaturaDataUrl(): string | null {
    if (!temTraco) return assinaturaAtual || null;
    return canvasRef.current!.toDataURL("image/png");
  }

  function salvar() {
    const dataUrl = assinaturaDataUrl();
    if (!dataUrl) return;
    setSalvo(false);
    setErro(null);
    startTransition(async () => {
      const res = await salvarAssinatura(osId, dataUrl);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setSalvo(true);
    });
  }

  function aprovar() {
    const dataUrl = assinaturaDataUrl();
    if (!dataUrl) {
      setErro("Peça para o cliente assinar antes de aprovar.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await aprovarOrcamentoComAssinatura(osId, dataUrl, obs.trim() || null);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setAprovadoOk(true);
    });
  }

  return (
    <div>
      {podeAprovar && !aprovado && (
        <p className="mb-3 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-800">
          Cliente no local? Colete a assinatura abaixo e toque em{" "}
          <strong>Aprovar orçamento</strong> — dispensa o portal.
        </p>
      )}
      {aprovado && (
        <p className="mb-2 text-xs font-medium text-green-600">✓ Orçamento já aprovado.</p>
      )}
      {assinaturaAtual && !temTraco && (
        <div className="mb-2 rounded-lg border border-green-200 bg-green-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assinaturaAtual} alt="Assinatura" className="h-16 object-contain" />
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
      {podeAprovar && !aprovado && (
        <input
          className="input mt-2 text-sm"
          placeholder="Observação do cliente (opcional)"
          value={obs}
          onChange={(e) => setObs(e.target.value)}
        />
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button onClick={limpar} className="btn-secondary text-sm" type="button">
          <Eraser className="h-4 w-4" /> Limpar
        </button>
        <button
          onClick={salvar}
          disabled={(!temTraco && !assinaturaAtual) || pending}
          className="btn-secondary text-sm"
          type="button"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Só salvar assinatura
        </button>
        {podeAprovar && !aprovado && (
          <button
            onClick={aprovar}
            disabled={pending}
            className="btn-primary text-sm"
            type="button"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
            Aprovar orçamento
          </button>
        )}
        {salvo && <span className="text-sm text-green-600">Assinatura salva!</span>}
        {aprovadoOk && <span className="text-sm font-medium text-green-600">Orçamento aprovado!</span>}
        {erro && <span className="text-sm text-red-600">{erro}</span>}
      </div>
    </div>
  );
}

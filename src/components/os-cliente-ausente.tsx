"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Eraser, Check, Loader2, ImagePlus, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./toast";

export function OsClienteAusente({
  osId,
  assinaturaAtual,
  observacaoAtual,
  action,
}: {
  osId: string;
  assinaturaAtual?: string | null;
  observacaoAtual?: string | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);
  const [obs, setObs] = useState(observacaoAtual || "");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const supabase = createClient();

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

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    desenhando.current = true;
    setTemTraco(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }
  function moveDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function endDraw() {
    desenhando.current = false;
  }

  function limpar() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setTemTraco(false);
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${osId}/ausente-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("os-fotos").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("os-fotos").getPublicUrl(path);
      setFotoUrl(data.publicUrl);
      setFotoPath(path);
    } catch (err) {
      toast.push((err as Error).message || "Erro ao enviar foto.", "error");
    } finally {
      setEnviandoFoto(false);
      e.target.value = "";
    }
  }

  function registrar() {
    if (!temTraco && !assinaturaAtual) {
      toast.push("Assine no quadro abaixo.", "error");
      return;
    }
    if (!fotoUrl) {
      toast.push("Tire uma foto do local/equipamento (cliente ausente).", "error");
      return;
    }
    const fd = new FormData();
    fd.set(
      "assinatura_tecnico",
      temTraco ? canvasRef.current!.toDataURL("image/png") : assinaturaAtual || ""
    );
    fd.set("observacao", obs);
    fd.set("foto_url", fotoUrl);
    fd.set("foto_path", fotoPath || "");
    start(async () => {
      try {
        await action(fd);
        toast.push("Cliente ausente registrado com sucesso.", "success");
      } catch (e) {
        toast.push((e as Error).message || "Erro ao registrar.", "error");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-amber-800">
        <UserX className="h-4 w-4" />
        Registre assinatura do técnico e foto quando o cliente não estiver presente.
      </p>

      {assinaturaAtual && !temTraco && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assinaturaAtual} alt="Assinatura técnico" className="h-16 object-contain" />
          <p className="text-xs text-green-700">Assinatura já registrada.</p>
        </div>
      )}

      <div>
        <label className="label">Assinatura do técnico *</label>
        <canvas
          ref={canvasRef}
          width={360}
          height={120}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="w-full touch-none rounded-lg border border-slate-300 bg-white"
          style={{ aspectRatio: "360 / 120" }}
        />
        <button type="button" onClick={limpar} className="btn-secondary mt-2 text-sm">
          <Eraser className="h-4 w-4" /> Limpar assinatura
        </button>
      </div>

      <div>
        <label className="label">Foto comprobatória *</label>
        <label className="btn-secondary inline-flex cursor-pointer text-sm">
          {enviandoFoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Tirar / enviar foto
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
        </label>
        {fotoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt="Foto cliente ausente" className="mt-2 h-32 rounded-lg border object-cover" />
        )}
      </div>

      <div>
        <label className="label">Observação</label>
        <textarea
          className="input"
          rows={2}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Ex: Cliente não atendeu, equipamento deixado na portaria..."
        />
      </div>

      <button type="button" onClick={registrar} disabled={pending} className="btn-primary w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        <Check className="h-4 w-4" />
        Registrar cliente ausente
      </button>
    </div>
  );
}

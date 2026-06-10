"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Loader2, ScanLine } from "lucide-react";
import { resolverOsPorCodigo } from "@/app/(app)/escanear/actions";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<{ rawValue: string }[]>;
};

export function OsQrScanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopRef = useRef<number | null>(null);
  const processandoRef = useRef(false);

  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [suportaCamera, setSuportaCamera] = useState(false);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [manual, setManual] = useState("");

  const processar = useCallback(
    async (texto: string) => {
      if (processandoRef.current || !texto.trim()) return;
      processandoRef.current = true;
      setBuscando(true);
      setErro("");
      try {
        const res = await resolverOsPorCodigo(texto);
        if (res.id) {
          router.push(`/ordens/${res.id}`);
          return;
        }
        setErro(res.erro || "Ordem não encontrada.");
      } catch {
        setErro("Erro ao buscar a ordem. Tente novamente.");
      } finally {
        setBuscando(false);
        processandoRef.current = false;
      }
    },
    [router]
  );

  const pararCamera = useCallback(() => {
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current);
      loopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraAtiva(false);
  }, []);

  const iniciarCamera = useCallback(async () => {
    setErro("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Câmera não disponível neste dispositivo. Use o campo manual abaixo.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraAtiva(true);

      const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike })
        .BarcodeDetector;
      if (!Detector) {
        setErro("Leitura automática indisponível neste navegador. Digite ou cole o código da OS.");
        return;
      }

      const detector = new Detector({ formats: ["qr_code"] });
      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          loopRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            pararCamera();
            await processar(codes[0].rawValue);
            return;
          }
        } catch {
          /* frame sem QR */
        }
        loopRef.current = requestAnimationFrame(scan);
      };
      loopRef.current = requestAnimationFrame(scan);
    } catch {
      setErro("Não foi possível acessar a câmera. Verifique as permissões ou use o campo manual.");
      pararCamera();
    }
  }, [pararCamera, processar]);

  useEffect(() => {
    setSuportaCamera(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        "BarcodeDetector" in window
    );
    return () => pararCamera();
  }, [pararCamera]);

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden p-0">
        <div className="relative aspect-[4/3] max-h-80 w-full bg-slate-900">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            aria-label="Visualização da câmera para leitura de QR"
          />
          {!cameraAtiva && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/90 text-slate-300">
              <ScanLine className="h-12 w-12 text-brand-400" />
              <p className="text-sm">Aponte a câmera para o QR da etiqueta da OS</p>
            </div>
          )}
          {buscando && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/70">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
          {!cameraAtiva ? (
            <button type="button" onClick={iniciarCamera} className="btn-primary">
              <Camera className="h-4 w-4" /> Ativar câmera
            </button>
          ) : (
            <button type="button" onClick={pararCamera} className="btn-secondary">
              <CameraOff className="h-4 w-4" /> Desligar câmera
            </button>
          )}
          {!suportaCamera && (
            <span className="text-xs text-slate-500 self-center">
              Leitura automática requer Chrome/Edge no celular ou desktop.
            </span>
          )}
        </div>
      </div>

      <div className="card p-5">
        <p className="mb-3 text-sm font-medium text-slate-700">Ou digite / cole o código</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            processar(manual);
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="OS-00123, número ou link do QR..."
            className="input flex-1"
            autoComplete="off"
          />
          <button type="submit" disabled={buscando || !manual.trim()} className="btn-primary shrink-0">
            {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Abrir OS
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Aceita QR da etiqueta, link /ordens/…, número da OS ou UUID.
        </p>
      </div>

      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}
    </div>
  );
}

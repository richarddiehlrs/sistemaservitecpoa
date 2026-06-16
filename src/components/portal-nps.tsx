"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Star } from "lucide-react";
import { GOOGLE_REVIEW_URL } from "@/lib/pix";
import { registrarNpsPortal } from "@/app/os/portal-actions";

export function PortalNps({
  token,
  notaInicial,
  comentarioInicial,
}: {
  token: string;
  notaInicial?: number | null;
  comentarioInicial?: string | null;
}) {
  const [nota, setNota] = useState<number | null>(notaInicial ?? null);
  const [comentario, setComentario] = useState(comentarioInicial || "");
  const [hover, setHover] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (notaInicial != null) {
    return (
      <div className="card mb-4 border-green-200 bg-green-50/60 p-5 no-print">
        <h2 className="mb-2 font-semibold text-green-900">Obrigado pela avaliação!</h2>
        <div className="mb-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <Star
              key={n}
              className={`h-5 w-5 ${n <= notaInicial ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
            />
          ))}
        </div>
        {comentarioInicial && <p className="text-sm text-slate-600">&ldquo;{comentarioInicial}&rdquo;</p>}
        <a
          href={GOOGLE_REVIEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
        >
          Avaliar também no Google →
        </a>
      </div>
    );
  }

  function enviar() {
    if (nota == null) {
      setErro("Escolha uma nota de 1 a 5.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await registrarNpsPortal(token, nota, comentario);
      if (!res.ok) setErro(res.erro || "Não foi possível enviar.");
      else router.refresh();
    });
  }

  return (
    <div className="card mb-4 p-5 no-print">
      <h2 className="mb-1 font-semibold text-slate-900">Como foi o atendimento?</h2>
      <p className="mb-4 text-sm text-slate-500">Sua opinião nos ajuda a melhorar (NPS).</p>

      <div className="mb-4 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setNota(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="rounded p-1 transition hover:scale-110"
            aria-label={`Nota ${n}`}
          >
            <Star
              className={`h-8 w-8 ${
                n <= (hover || nota || 0) ? "fill-amber-400 text-amber-400" : "text-slate-300"
              }`}
            />
          </button>
        ))}
      </div>

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={2}
        className="input mb-3 text-sm"
        placeholder="Comentário opcional..."
      />

      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}

      <button type="button" onClick={enviar} disabled={pending} className="btn-primary w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar avaliação"}
      </button>
    </div>
  );
}

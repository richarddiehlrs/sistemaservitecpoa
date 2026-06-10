"use client";

import { useState, useTransition } from "react";
import { Loader2, ImagePlus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { OsAnexo } from "@/types/database";
import { registrarAnexo, excluirAnexo } from "@/app/(app)/ordens/anexos-actions";

export function OsFotos({
  osId,
  anexos,
}: {
  osId: string;
  anexos: OsAnexo[];
}) {
  const supabase = createClient();
  const [enviando, setEnviando] = useState(false);
  const [momento, setMomento] = useState<"antes" | "depois" | "outro">("antes");
  const [, startTransition] = useTransition();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setEnviando(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${osId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error } = await supabase.storage.from("os-fotos").upload(path, file, {
        cacheControl: "3600",
      });
      if (error) {
        alert("Erro ao enviar foto: " + error.message);
        continue;
      }
      const { data } = supabase.storage.from("os-fotos").getPublicUrl(path);
      const fd = new FormData();
      fd.set("os_id", osId);
      fd.set("url", data.publicUrl);
      fd.set("path", path);
      fd.set("momento", momento);
      await registrarAnexo(fd);
    }
    setEnviando(false);
    e.target.value = "";
  }

  function remover(a: OsAnexo) {
    startTransition(async () => {
      await excluirAnexo(a.id, a.path || "", osId);
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <select
          value={momento}
          onChange={(e) => setMomento(e.target.value as never)}
          className="input max-w-[130px] text-sm"
        >
          <option value="antes">Antes</option>
          <option value="depois">Depois</option>
          <option value="outro">Outro</option>
        </select>
        <label className="btn-secondary cursor-pointer text-sm">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          Adicionar fotos
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </label>
      </div>

      {anexos.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhuma foto anexada.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {anexos.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                <img src={a.url} alt={a.descricao || "foto"} className="h-28 w-full object-cover" />
              </a>
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] capitalize text-white">
                {a.momento}
              </span>
              <button
                onClick={() => remover(a)}
                className="absolute right-1 top-1 rounded bg-white/80 p-1 text-red-500 opacity-0 transition group-hover:opacity-100"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// Fila de despesas salvas no celular (IndexedDB) para enviar quando houver sinal.
// Cada item tem um id gerado no aparelho (id_cliente): se o envio for repetido,
// o banco reconhece e não duplica o lançamento.

import { createClient } from "@/lib/supabase/client";

export type DespesaPendente = {
  idCliente: string;
  categoria: string;
  valor: number;
  data: string; // YYYY-MM-DD
  contaId: string | null;
  forma: string | null;
  osId: string | null;
  descricao: string | null;
  km: number | null;
  litros: number | null;
  foto: Blob | null;
  criadoEm: number;
  tentativas: number;
  erro?: string | null;
};

const DB = "servitec-campo";
const STORE = "despesas";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "idCliente" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, modo);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function guardarDespesa(d: DespesaPendente): Promise<void> {
  await tx("readwrite", (s) => s.put(d));
}

export async function listarPendentes(): Promise<DespesaPendente[]> {
  try {
    const itens = await tx<DespesaPendente[]>("readonly", (s) => s.getAll() as IDBRequest<DespesaPendente[]>);
    return itens.sort((a, b) => a.criadoEm - b.criadoEm);
  } catch {
    return [];
  }
}

export async function removerPendente(idCliente: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(idCliente));
}

export function novoIdCliente(): string {
  return crypto.randomUUID();
}

/** Envia um item: sobe o comprovante e lança a despesa (já paga) no financeiro. */
async function enviarUm(d: DespesaPendente): Promise<void> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Sessão expirada — entre novamente no sistema.");

  let caminho: string | null = null;
  if (d.foto) {
    caminho = `${auth.user.id}/${d.data.slice(0, 7)}/${d.idCliente}.jpg`;
    const { error } = await supabase.storage
      .from("comprovantes")
      .upload(caminho, d.foto, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`Comprovante: ${error.message}`);
  }

  const { error } = await supabase.rpc("lancar_despesa_campo", {
    p_id_cliente: d.idCliente,
    p_categoria: d.categoria,
    p_valor: d.valor,
    p_data: d.data,
    p_conta_id: d.contaId,
    p_forma: d.forma,
    p_os_id: d.osId,
    p_descricao: d.descricao,
    p_km: d.km,
    p_litros: d.litros,
    p_comprovante_path: caminho,
  });
  if (error) throw new Error(error.message);
}

let sincronizando: Promise<{ enviados: number; falhas: number }> | null = null;

/** Envia tudo o que estiver na fila. Seguro chamar várias vezes. */
export function sincronizarFila(): Promise<{ enviados: number; falhas: number }> {
  if (sincronizando) return sincronizando;
  sincronizando = (async () => {
    let enviados = 0;
    let falhas = 0;
    if (typeof navigator !== "undefined" && !navigator.onLine) return { enviados, falhas };
    for (const d of await listarPendentes()) {
      try {
        await enviarUm(d);
        await removerPendente(d.idCliente);
        enviados++;
      } catch (e) {
        falhas++;
        const msg = e instanceof Error ? e.message : String(e);
        // Erro de rede: tenta de novo depois; erro de regra (ex.: data futura): mostra ao usuário
        await guardarDespesa({ ...d, tentativas: d.tentativas + 1, erro: /fetch|network|Failed|rede/i.test(msg) ? null : msg });
      }
    }
    return { enviados, falhas };
  })().finally(() => {
    sincronizando = null;
  });
  return sincronizando;
}

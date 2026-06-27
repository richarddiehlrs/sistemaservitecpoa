import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const envPath = ".env.local";
if (!fs.existsSync(envPath)) {
  console.log("NO_ENV");
  process.exit(1);
}

const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 0) continue;
  env[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, "");
}

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data: osList, error: e1 } = await sb
  .from("ordens_servico")
  .select(
    "id, numero, status, aprovado, cliente_id, tecnico, equipamento_id, data_abertura, valor_total, created_at"
  )
  .eq("numero", 7);

if (e1) {
  console.error("OS_ERR", e1.message);
  process.exit(1);
}

console.log("OS_COUNT", osList?.length || 0);
console.log(JSON.stringify(osList, null, 2));

if (!osList?.length) process.exit(0);

for (const os of osList) {
  const id = os.id;
  const [eq, fin, ag, it, hist, osFull] = await Promise.all([
    sb.from("os_equipamentos").select("id, equipamento_id, ordem").eq("os_id", id),
    sb
      .from("lancamentos_financeiros")
      .select("id, tipo, descricao, valor, status, created_at")
      .eq("os_id", id),
    sb.from("agendamentos").select("id, data, status, titulo, created_at").eq("os_id", id),
    sb.from("os_itens").select("id, descricao, tipo, valor_unitario, quantidade").eq("os_id", id),
    sb
      .from("os_status_historico")
      .select("id, status, observacao, created_at")
      .eq("os_id", id)
      .order("created_at"),
    sb.from("ordens_servico").select("*, clientes(nome), equipamentos(*)").eq("id", id).single(),
  ]);

  console.log("\n--- OS id", id);
  console.log("cliente", osFull.data?.clientes?.nome);
  console.log("equipamento_id", os.equipamento_id);
  console.log("equip join", JSON.stringify(osFull.data?.equipamentos));
  console.log(
    "os_equipamentos",
    eq.data?.length,
    eq.error?.message || "",
    JSON.stringify(eq.data)
  );
  console.log("financeiro", fin.data?.length, JSON.stringify(fin.data));
  console.log("agendamentos", ag.data?.length, JSON.stringify(ag.data));
  console.log("itens", it.data?.length, JSON.stringify(it.data));
  console.log("historico", hist.data?.length);
  for (const h of hist.data || []) {
    console.log(" ", h.created_at, h.status, (h.observacao || "").slice(0, 80));
  }
}

const { data: allNums } = await sb.from("ordens_servico").select("numero");
const counts = {};
for (const r of allNums || []) counts[r.numero] = (counts[r.numero] || 0) + 1;
const dups = Object.entries(counts).filter(([, c]) => c > 1);
console.log("\nDUPLICATE_NUMEROS", JSON.stringify(dups));

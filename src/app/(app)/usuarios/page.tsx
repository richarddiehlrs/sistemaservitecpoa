import { ShieldAlert, Save } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/config";
import { atualizarUsuario } from "./actions";
import { ActionForm } from "@/components/use-action";

export const dynamic = "force-dynamic";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  atendente: "Atendente",
  tecnico: "Técnico",
};

export default async function UsuariosPage() {
  const role = await getRole();
  if (role !== "admin") {
    return (
      <div>
        <PageHeader title="Usuários" />
        <div className="card flex items-center gap-3 p-6 text-slate-600">
          <ShieldAlert className="h-6 w-6 text-amber-500" />
          Apenas administradores podem gerenciar usuários.
        </div>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at");

  return (
    <div>
      <PageHeader
        title="Usuários e permissões"
        subtitle="Defina o papel de cada membro da equipe"
      />

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Papel</th>
              <th>Ativo</th>
              <th className="text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios || []).map((u) => (
              <tr key={u.id}>
                <td colSpan={5} className="p-0">
                  <ActionForm action={atualizarUsuario.bind(null, u.id)} successMsg="Usuário atualizado." className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <input name="nome" defaultValue={u.nome || ""} className="input max-w-[180px]" placeholder="Nome" />
                    <span className="min-w-[200px] flex-1 text-sm text-slate-500">{u.email}</span>
                    <select name="papel" defaultValue={u.papel} className="input max-w-[160px]">
                      {Object.entries(PAPEL_LABEL).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <select name="ativo" defaultValue={String(u.ativo)} className="input max-w-[120px]">
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                    <button className="btn-primary text-sm">
                      <Save className="h-4 w-4" /> Salvar
                    </button>
                  </ActionForm>
                </td>
              </tr>
            ))}
            {(!usuarios || usuarios.length === 0) && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  Nenhum usuário. Crie usuários em Supabase → Authentication → Users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-slate-500">
        Para adicionar um novo usuário, crie-o em <strong>Supabase → Authentication → Users</strong>.
        Ele aparecerá aqui automaticamente para você definir o papel.
      </p>
    </div>
  );
}

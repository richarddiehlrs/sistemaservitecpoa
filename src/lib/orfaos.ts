/** Registros de agenda/financeiro sem OS válida (exclusões antigas). */

export type AgendamentoOrfao = {
  id: string;
  titulo: string;
  data: string;
  status: string;
  tecnico: string | null;
  os_id: string | null;
  motivo: "os_inexistente" | "visita_sem_os";
};

export type LancamentoOrfao = {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  status: string;
  data_competencia: string;
  os_id: string | null;
  motivo: "os_inexistente" | "descricao_os";
};

export function filtrarAgendamentosOrfaos(
  agendamentos: {
    id: string;
    titulo: string;
    data: string;
    status: string;
    tecnico: string | null;
    os_id: string | null;
  }[],
  osIdsValidos: Set<string>
): AgendamentoOrfao[] {
  return agendamentos
    .filter((a) => {
      if (a.os_id && !osIdsValidos.has(a.os_id)) return true;
      if (!a.os_id && /Visita OS-/i.test(a.titulo)) return true;
      return false;
    })
    .map((a) => ({
      ...a,
      motivo: a.os_id && !osIdsValidos.has(a.os_id) ? "os_inexistente" : "visita_sem_os",
    })) as AgendamentoOrfao[];
}

export function filtrarLancamentosOrfaos(
  lancamentos: {
    id: string;
    descricao: string;
    tipo: string;
    valor: number;
    status: string;
    data_competencia: string;
    os_id: string | null;
  }[],
  osIdsValidos: Set<string>
): LancamentoOrfao[] {
  return lancamentos
    .filter((l) => {
      if (l.os_id && !osIdsValidos.has(l.os_id)) return true;
      if (!l.os_id && /^(Receita|Custo) OS-/i.test(l.descricao)) return true;
      return false;
    })
    .map((l) => ({
      ...l,
      motivo: l.os_id && !osIdsValidos.has(l.os_id) ? "os_inexistente" : "descricao_os",
    })) as LancamentoOrfao[];
}

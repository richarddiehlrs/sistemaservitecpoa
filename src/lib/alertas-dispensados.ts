export type AlertaDispensadoEntry = {
  ref_tipo: string;
  ref_id: string | null;
  dispensado_em: string;
};

export function chaveAlertaDispensado(refTipo: string, refId: string | null | undefined): string {
  return `${refTipo}:${refId ?? "_"}`;
}

export function parseAlertasDispensados(raw: unknown): AlertaDispensadoEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is AlertaDispensadoEntry =>
      e != null &&
      typeof e === "object" &&
      typeof (e as AlertaDispensadoEntry).ref_tipo === "string" &&
      ("ref_id" in e ? (e as AlertaDispensadoEntry).ref_id == null || typeof (e as AlertaDispensadoEntry).ref_id === "string" : true)
  );
}

export function mesclarAlertasDispensados(
  atuais: AlertaDispensadoEntry[],
  novos: AlertaDispensadoEntry[],
  max = 500
): AlertaDispensadoEntry[] {
  const map = new Map<string, AlertaDispensadoEntry>();
  for (const e of [...atuais, ...novos]) {
    map.set(chaveAlertaDispensado(e.ref_tipo, e.ref_id), e);
  }
  return Array.from(map.values()).slice(-max);
}

export function alertaEstaDispensado(
  lista: AlertaDispensadoEntry[],
  refTipo: string,
  refId?: string | null
): boolean {
  return lista.some((e) => chaveAlertaDispensado(e.ref_tipo, e.ref_id) === chaveAlertaDispensado(refTipo, refId ?? null));
}

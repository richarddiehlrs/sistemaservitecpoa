/** Status em que o cliente pode aprovar orçamento no portal (alinhado ao ERP). */
export const STATUS_PORTAL_PODE_APROVAR = [
  "aberta",
  "em_analise",
  "aguardando_aprovacao",
] as const;

export function podeAprovarOrcamentoPortal(os: {
  aprovado: boolean;
  status: string;
  valorTotal: number;
}): boolean {
  if (os.aprovado) return false;
  if (os.valorTotal <= 0) return false;
  if (["cancelada", "cliente_ausente", "concluida", "entregue"].includes(os.status)) {
    return false;
  }
  return (STATUS_PORTAL_PODE_APROVAR as readonly string[]).includes(os.status);
}

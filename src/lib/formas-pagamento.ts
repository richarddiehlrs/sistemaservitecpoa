export const FORMAS_PAGAMENTO = [
  "Dinheiro",
  "PIX",
  "Cartão de débito",
  "Cartão de crédito",
  "Boleto",
  "Transferência",
] as const;

export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

import { formatCurrency, formatDate, hojeYmdLocal, onlyDigits } from "@/lib/format";
import { assinatura, saudacao } from "@/lib/mensagens-cliente";
import { formatPixCnpj, PIX_CHAVE_CNPJ, pixCopiaCola } from "@/lib/pix";

export function telefoneComDDI(telefone: string | null | undefined): string {
  const tel = onlyDigits(telefone || "");
  if (tel.length < 10) return "";
  return tel.startsWith("55") ? tel : `55${tel}`;
}

export function linkWhatsApp(telefone: string | null | undefined, texto: string): string | null {
  const ddi = telefoneComDDI(telefone);
  return ddi ? `https://wa.me/${ddi}?text=${encodeURIComponent(texto)}` : null;
}

/** "Receita OS-00037" (nome interno do lançamento) → "Serviço da OS-00037". */
export function descricaoParaCliente(descricao: string): string {
  const d = descricao.trim();
  const m = d.match(/^Receita\s+(OS-\d+)/i);
  if (m) return `Serviço da ${m[1].toUpperCase()}`;
  return d.replace(/\s*\((\d+)\/(\d+)\)$/, " — parcela $1 de $2");
}

export function mensagemCobranca({
  cliente,
  descricao,
  valor,
  vencimento,
  empresa,
  empresaTelefone,
  hora,
}: {
  cliente?: string | null;
  descricao: string;
  valor: number;
  vencimento?: string | null;
  empresa: string;
  empresaTelefone?: string | null;
  hora?: number;
}): string {
  const pix = pixCopiaCola({ nome: empresa, valor });
  const vencido = vencimento && vencimento < hojeYmdLocal();
  const linhas = [
    `${saudacao(cliente, hora)} Tudo bem?`,
    `Aqui é da *${empresa}*. ${
      vencido ? "Consta em nosso sistema um valor em aberto" : "Passando para lembrar do pagamento"
    } referente a:`,
    [
      `*${descricaoParaCliente(descricao)}*`,
      `*Valor:* ${formatCurrency(valor)}`,
      vencimento ? `*Vencimento:* ${formatDate(vencimento)}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    `Para sua comodidade, você pode pagar por PIX:\n*Chave (CNPJ):* ${formatPixCnpj(PIX_CHAVE_CNPJ)}\n\n*PIX copia e cola* (já com o valor):\n${pix}`,
    "Se o pagamento já foi realizado, por favor desconsidere esta mensagem — e, se puder, nos envie o comprovante por aqui.",
    assinatura(empresa, empresaTelefone),
  ];
  return linhas.join("\n\n");
}

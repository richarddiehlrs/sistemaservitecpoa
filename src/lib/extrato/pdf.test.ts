import { it, expect } from "vitest";
import { lerExtrato } from "@/lib/extrato";

function pdfComLinhas(linhas: string[]): Uint8Array {
  // PDF mínimo: cada linha em uma altura; colunas separadas em pedaços (como bancos fazem)
  const ops = linhas
    .map((l, i) => l.split("|").map((parte, j) => `BT /F1 9 Tf ${40 + j * 130} ${780 - i * 14} Td (${parte}) Tj ET`).join("\n"))
    .join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${ops.length} >>\nstream\n${ops}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(out);
}

it("lê PDF real (texto em colunas) via unpdf", async () => {
  const pdf = pdfComLinhas([
    "Data|Historico|Docto.|Credito (R$)|Saldo (R$)",
    "01/11/2026|SALDO ANTERIOR|||1.000,00",
    "03/11/2026|PIX RECEBIDO|1234567|350,00|1.350,00",
    "|TARIFA BANCARIA||12,90|1.337,10",
  ]);
  const r = await lerExtrato("extrato.pdf", pdf);

  expect(r.formato).toBe("pdf");
  expect(r.transacoes.map((t) => t.valor)).toEqual([350, -12.9]);
  expect(r.saldoFinal).toBe(1337.1);
});

import { qrImageUrl } from "@/lib/qrcode";
import { urlAbrirOs } from "@/lib/os-scan";
import { formatDate, formatNumeroOS, formatTelefone } from "@/lib/format";
import type { Cliente, Equipamento, OrdemServico } from "@/types/database";
import { linhaEquipamento } from "@/lib/os-equipamentos";

function truncar(texto: string | null | undefined, max: number): string {
  const t = (texto || "").trim();
  if (t.length <= max) return t || "—";
  return `${t.slice(0, max - 1)}…`;
}

export function EtiquetaOsPrint({
  os,
  cliente,
  equip,
  equips = [],
  empresaNome,
  siteUrl,
}: {
  os: OrdemServico;
  cliente: Cliente | null;
  equip: Equipamento | null;
  equips?: Equipamento[];
  empresaNome: string;
  siteUrl: string;
}) {
  const listaEquips = equips.length > 0 ? equips : equip ? [equip] : [];
  const textoEquip =
    listaEquips.length > 1
      ? `${listaEquips.length} aparelhos`
      : linhaEquipamento(listaEquips[0]);

  const qrUrl = urlAbrirOs(os.id, siteUrl);
  const qrImg = qrImageUrl(qrUrl, 180);

  return (
    <div className="folha-etiqueta">
      <div className="etiqueta-os">
        <div className="etiqueta-os-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrImg} alt={`QR ${formatNumeroOS(os.numero)}`} width={180} height={180} />
        </div>
        <div className="etiqueta-os-info">
          <p className="etiqueta-os-empresa">{empresaNome}</p>
          <p className="etiqueta-os-numero">{formatNumeroOS(os.numero)}</p>
          <p className="etiqueta-os-linha">
            <strong>Cliente:</strong> {truncar(cliente?.nome, 28)}
          </p>
          {cliente?.telefone && (
            <p className="etiqueta-os-linha">
              <strong>Tel:</strong> {formatTelefone(cliente.telefone)}
            </p>
          )}
          <p className="etiqueta-os-linha">
            <strong>Equip.:</strong> {truncar(textoEquip, 32)}
          </p>
          <p className="etiqueta-os-linha">
            <strong>Defeito:</strong> {truncar(os.defeito_relatado, 40)}
          </p>
          <p className="etiqueta-os-data">{formatDate(os.data_abertura)} · Oficina</p>
        </div>
      </div>
    </div>
  );
}

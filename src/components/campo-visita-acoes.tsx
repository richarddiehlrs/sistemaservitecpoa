import { MapPin, MessageCircle, Phone } from "lucide-react";
import { linkMapa, linkMapaEndereco } from "@/lib/geo";
import { formatHora, formatTelefone, onlyDigits } from "@/lib/format";
import { mensagemWhatsAppCliente } from "@/lib/mensagens-cliente";
import { EMPRESA } from "@/lib/utils";

type Props = {
  telefone?: string | null;
  endereco?: string | null;
  checkinLat?: number | null;
  checkinLng?: number | null;
  clienteNome?: string | null;
  tecnicoNome?: string | null;
  horaInicio?: string | null;
  osNumero?: number | null;
};

function telefoneComDDI(telefone: string | null | undefined): string {
  const tel = onlyDigits(telefone || "");
  if (tel.length < 10) return "";
  return tel.startsWith("55") ? tel : `55${tel}`;
}

function mensagemVisitaCampo(p: Props): string {
  if (p.osNumero == null) {
    const hora = p.horaInicio ? formatHora(p.horaInicio) : "hoje";
    return (
      `Olá ${p.clienteNome || ""}! Sou ${p.tecnicoNome || "o técnico"} da ${EMPRESA.nome}. ` +
      `Estou a caminho para o atendimento agendado para ${hora}.`
    );
  }
  return mensagemWhatsAppCliente("tecnico_caminho", {
    empresa: EMPRESA.nome,
    cliente: p.clienteNome,
    numero: p.osNumero,
    horaInicio: p.horaInicio,
    tecnico: p.tecnicoNome,
  });
}

export function CampoVisitaAcoes(props: Props) {
  const { telefone, endereco, checkinLat, checkinLng } = props;

  const mapHref =
    checkinLat != null && checkinLng != null
      ? linkMapa(checkinLat, checkinLng)
      : endereco?.trim()
        ? linkMapaEndereco(endereco.trim())
        : null;

  const ddi = telefoneComDDI(telefone);
  const telHref = ddi ? `tel:+${ddi}` : null;
  const waHref = ddi
    ? `https://wa.me/${ddi}?text=${encodeURIComponent(mensagemVisitaCampo(props))}`
    : null;

  if (!mapHref && !telHref && !waHref) return null;

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition hover:shadow-sm";

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {mapHref && (
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100`}
        >
          <MapPin className="h-3.5 w-3.5" />
          Maps
        </a>
      )}
      {telHref && (
        <a
          href={telHref}
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <Phone className="h-3.5 w-3.5" />
          {formatTelefone(telefone) || "Ligar"}
        </a>
      )}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} border-green-200 bg-green-50 text-green-800 hover:bg-green-100`}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
      )}
    </div>
  );
}

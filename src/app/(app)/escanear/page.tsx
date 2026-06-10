import { ScanLine } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { OsQrScanner } from "@/components/os-qr-scanner";
import { requirePermissao } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function EscanearPage() {
  await requirePermissao("ordens");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Escanear OS"
        subtitle="Leia o QR da etiqueta de oficina para abrir a ordem de serviço diretamente."
        action={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <ScanLine className="h-5 w-5" />
          </div>
        }
      />
      <OsQrScanner />
    </div>
  );
}

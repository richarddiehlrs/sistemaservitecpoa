import QRCode from "qrcode";

/**
 * QR Code gerado no próprio sistema (SVG em data URI), sem depender de site externo.
 * Nível de correção "M" e margem de 2 módulos — lê bem impresso e na tela.
 * O parâmetro `size` fica só por compatibilidade: o SVG escala sem perder nitidez.
 */
export function qrImageUrl(data: string, size = 120): string {
  const qr = QRCode.create(data, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const margem = 2;
  const total = n + margem * 2;
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (qr.modules.get(y, x)) path += `M${x + margem} ${y + margem}h1v1h-1z`;
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${size}" height="${size}" shape-rendering="crispEdges">` +
    `<rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

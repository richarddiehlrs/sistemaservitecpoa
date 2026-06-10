/** URL da imagem QR via API pública (sem dependência extra). */
export function qrImageUrl(data: string, size = 120): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

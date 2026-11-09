"use client";

/**
 * Reduz a foto do comprovante (câmera do iPhone gera 3–5 MB) para ~150–300 KB:
 * lado maior até 1600 px, JPEG 0.72. Mantém legível e economiza dados e espaço.
 */
export async function comprimirFoto(arquivo: File, ladoMax = 1600, qualidade = 0.72): Promise<Blob> {
  const bitmap = await carregar(arquivo);
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return arquivo;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", qualidade));
  return blob ?? arquivo;
}

async function carregar(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // imageOrientation respeita a rotação da foto do iPhone
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* Safari antigo: cai no <img> */
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

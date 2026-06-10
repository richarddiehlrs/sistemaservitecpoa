/** Link para abrir coordenadas no Google Maps. */
export function linkMapa(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function formatCoordenadas(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Cliente: obtém posição GPS do dispositivo (PWA/navegador). */
export function obterPosicaoGps(): Promise<{ lat: number; lng: number; precisao: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GPS não disponível neste dispositivo."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          precisao: pos.coords.accuracy,
        }),
      (err) => {
        const msg =
          err.code === 1
            ? "Permissão de localização negada. Ative o GPS nas configurações do celular."
            : err.code === 2
              ? "Não foi possível obter a localização. Verifique o GPS."
              : "Tempo esgotado ao buscar GPS. Tente novamente.";
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

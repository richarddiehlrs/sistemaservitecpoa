import { ImageResponse } from "next/og";

/** Ícone do app em PNG (o iPhone não aceita SVG na tela inicial). */
export function iconeApp(tamanho: number, comBorda = true): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2f9bff 0%, #1d4ed8 100%)",
          borderRadius: comBorda ? tamanho * 0.22 : 0,
          color: "#ffffff",
          fontSize: tamanho * 0.62,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        S
      </div>
    ),
    { width: tamanho, height: tamanho }
  );
}

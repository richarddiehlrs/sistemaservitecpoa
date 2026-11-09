import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ServitecPoa ERP",
    short_name: "ServitecPoa",
    description: "Gestão de assistência técnica de eletrodomésticos",
    start_url: "/campo",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f172a",
    theme_color: "#1d4ed8",
    icons: [
      { src: "/icone/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icone/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icone/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

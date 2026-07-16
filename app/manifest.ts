import type { MetadataRoute } from "next";

/** Manifest de la PWA: hace la app instalable en móvil/tablet. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Control de Drogas — Consulta Externa",
    short_name: "Control de Drogas",
    description: "Control seguro y trazable del inventario de medicamentos.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#102b43",
    theme_color: "#147d7c",
    lang: "es",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}

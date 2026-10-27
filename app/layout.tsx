import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./card-navigation.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

export const metadata: Metadata = {
  title: "Control de Drogas Consulta Externa",
  description: "Control seguro y trazable del inventario de medicamentos.",
  icons: { icon: "/favicon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Control de Drogas" },
};

export const viewport: Viewport = {
  themeColor: "#12695b",
};

// Aplica el tema guardado antes de pintar para evitar el parpadeo (FOUC).
const themeInit = "(function(){var t='light';try{var s=localStorage.getItem('theme');if(s==='dark'||s==='light')t=s;}catch(e){}document.documentElement.setAttribute('data-theme',t);})();";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Nonce por petición generado en proxy.ts; autoriza el script de tema
  // bajo la CSP forzada (script-src 'nonce-…' 'strict-dynamic').
  // Solo html (tema previo al pintado) y script (nonce ocultado por el navegador)
  // admiten diferencias de atributos durante la hidratación.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <head><script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body><AppErrorBoundary>{children}</AppErrorBoundary><ServiceWorkerRegister /></body>
    </html>
  );
}

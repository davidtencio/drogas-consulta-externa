import type { Metadata, Viewport } from "next";
import { Google_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

const appFont = Google_Sans({
  variable: "--font-app-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Control de Drogas Consulta Externa",
  description: "Control seguro y trazable del inventario de medicamentos.",
  icons: { icon: "/favicon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Control de Drogas" },
};

export const viewport: Viewport = {
  themeColor: "#0e7c6f",
};

// Aplica el tema guardado antes de pintar para evitar el parpadeo (FOUC).
const themeInit = "(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head><script dangerouslySetInnerHTML={{ __html: themeInit }} /></head>
      <body className={appFont.variable}><AppErrorBoundary>{children}</AppErrorBoundary><ServiceWorkerRegister /></body>
    </html>
  );
}

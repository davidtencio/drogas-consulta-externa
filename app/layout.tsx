import type { Metadata, Viewport } from "next";
import { Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./components/ServiceWorkerRegister";

const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Control de Drogas Consulta Externa",
  description: "Control seguro y trazable del inventario de medicamentos.",
  icons: { icon: "/favicon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Control de Drogas" },
};

export const viewport: Viewport = {
  themeColor: "#147d7c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={sourceSerif.variable}>{children}<ServiceWorkerRegister /></body></html>;
}

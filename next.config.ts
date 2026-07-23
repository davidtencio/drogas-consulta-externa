import type { NextConfig } from "next";

// Versión única por build. Se inyecta en el cliente y en la URL del service
// worker (?v=...) para invalidar la caché de la PWA en cada despliegue.
const swVersion = process.env.NEXT_PUBLIC_SW_VERSION ?? String(Date.now());

// Cabeceras de seguridad aplicadas a todas las rutas. Se omite a propósito una
// CSP de recursos (script/style/connect) restrictiva: Firebase Auth y Firestore
// requieren orígenes específicos que deben validarse contra el proyecto en vivo
// antes de forzarla. `frame-ancestors 'none'` sí es seguro y bloquea clickjacking.
const securityHeaders = [
  // Fuerza HTTPS durante 2 años, incluidos subdominios. Requiere que el sitio
  // se sirva siempre por HTTPS (App Hosting lo hace).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Evita que el navegador adivine (sniffing) el tipo MIME de una respuesta.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // La app nunca debe incrustarse en un iframe de terceros (anti-clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // No filtrar la ruta completa como referer hacia otros orígenes.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deshabilita APIs sensibles del navegador que la app no usa.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  // Fija la raíz del proyecto para evitar que Next infiera un workspace
  // equivocado cuando existen otros lockfiles fuera del repo.
  turbopack: { root: import.meta.dirname },
  env: { NEXT_PUBLIC_SW_VERSION: swVersion },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

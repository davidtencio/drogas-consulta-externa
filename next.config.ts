import type { NextConfig } from "next";

// Versión única por build. Se inyecta en el cliente y en la URL del service
// worker (?v=...) para invalidar la caché de la PWA en cada despliegue.
const swVersion = process.env.NEXT_PUBLIC_SW_VERSION ?? String(Date.now());

// Cabeceras de seguridad estáticas aplicadas a todas las rutas. La CSP NO va
// aquí: se genera por petición en `middleware.ts` con un nonce único para los
// scripts (enforcing). Estas complementan a la CSP.
const securityHeaders = [
  // Fuerza HTTPS durante 2 años, incluidos subdominios. Requiere que el sitio
  // se sirva siempre por HTTPS (App Hosting lo hace).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Evita que el navegador adivine (sniffing) el tipo MIME de una respuesta.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // La app nunca debe incrustarse en un iframe de terceros (anti-clickjacking).
  // Refuerza el `frame-ancestors 'none'` de la CSP en navegadores antiguos.
  { key: "X-Frame-Options", value: "DENY" },
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

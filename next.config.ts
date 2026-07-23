import type { NextConfig } from "next";

// Versión única por build. Se inyecta en el cliente y en la URL del service
// worker (?v=...) para invalidar la caché de la PWA en cada despliegue.
const swVersion = process.env.NEXT_PUBLIC_SW_VERSION ?? String(Date.now());

// CSP de recursos afinada a los orígenes de Firebase Auth (popup de Google) y
// Firestore. Se envía en modo Report-Only: NO bloquea, solo reporta violaciones,
// para validarla contra los flujos reales en producción sin riesgo de romper el
// inicio de sesión. Una vez confirmada sin violaciones legítimas, promuévala a
// enforcing moviéndola a la cabecera `Content-Security-Policy` (y considere
// reemplazar `'unsafe-inline'` de script-src por nonces/hashes).
const resourceCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // Auth (identitytoolkit/securetoken) y Firestore viven bajo *.googleapis.com.
  "connect-src 'self' https://*.googleapis.com https://*.google.com",
  // El manejador de Auth y el popup de Google se sirven desde estos orígenes.
  "frame-src 'self' https://drogas-consulta-externa.firebaseapp.com https://*.firebaseapp.com https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// Cabeceras de seguridad aplicadas a todas las rutas.
const securityHeaders = [
  // Fuerza HTTPS durante 2 años, incluidos subdominios. Requiere que el sitio
  // se sirva siempre por HTTPS (App Hosting lo hace).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Evita que el navegador adivine (sniffing) el tipo MIME de una respuesta.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // La app nunca debe incrustarse en un iframe de terceros (anti-clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  // Anti-clickjacking, forzado desde ya (seguro, no afecta Auth/Firestore).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // CSP de recursos completa, en observación (no bloquea) hasta validarla en vivo.
  { key: "Content-Security-Policy-Report-Only", value: resourceCsp },
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

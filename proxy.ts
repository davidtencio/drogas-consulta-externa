import { NextResponse, type NextRequest } from "next/server";

/**
 * Construye la CSP forzada para una petición, con un nonce único para los
 * scripts. Sustituye el `'unsafe-inline'` de scripts por `'nonce-…'` +
 * `'strict-dynamic'`: solo se ejecuta el script inline que lleva el nonce del
 * servidor (y los que este cargue en cadena, como los chunks de Next). Los
 * estilos conservan `'unsafe-inline'` porque la interfaz usa atributos
 * `style={{}}` que los nonces no cubren y cuyo riesgo de inyección es bajo.
 */
export function contentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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
}

/**
 * Genera un nonce por petición y aplica la CSP forzada. El nonce se propaga en
 * la cabecera de la petición (`x-nonce`) para que Next lo aplique a sus propios
 * scripts inline y para que el layout lo ponga en el script de tema. Usar nonces
 * implica render dinámico de las páginas HTML.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next lee el nonce desde esta cabecera de la petición y lo aplica a sus scripts.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Ejecuta el proxy en las rutas de documento HTML; excluye la API (JSON),
// los estáticos de Next y los archivos públicos, donde una CSP con nonce no aporta.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.svg|icon.svg|sw.js|manifest.webmanifest).*)",
  ],
};

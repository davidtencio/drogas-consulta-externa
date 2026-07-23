import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy, contentSecurityPolicy } from "../proxy";

const run = (path = "/") => proxy(new NextRequest(`https://app.example${path}`));

/** Extrae el segmento `script-src …` de una cadena de CSP. */
function scriptSrc(csp: string): string {
  return csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";
}

describe("proxy — CSP con nonce", () => {
  it("aplica la CSP forzada (Content-Security-Policy) en la respuesta", () => {
    const csp = run().headers.get("content-security-policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it("usa nonce + strict-dynamic y NO 'unsafe-inline' en script-src", () => {
    const csp = run().headers.get("content-security-policy") ?? "";
    const directive = scriptSrc(csp);
    expect(directive).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(directive).toContain("'strict-dynamic'");
    expect(directive).not.toContain("'unsafe-inline'");
  });

  it("mantiene los orígenes de Firebase Auth y Firestore", () => {
    const csp = run().headers.get("content-security-policy") ?? "";
    expect(csp).toContain("connect-src 'self' https://*.googleapis.com https://*.google.com");
    expect(csp).toContain("https://drogas-consulta-externa.firebaseapp.com");
    expect(csp).toContain("https://accounts.google.com");
  });

  it("genera un nonce distinto en cada petición", () => {
    const nonceOf = (csp: string) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(scriptSrc(csp))?.[1];
    const a = nonceOf(run().headers.get("content-security-policy") ?? "");
    const b = nonceOf(run().headers.get("content-security-policy") ?? "");
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  it("el nonce del script-src coincide con el resto de la política", () => {
    // contentSecurityPolicy es pura: mismo nonce en toda la cadena.
    const csp = contentSecurityPolicy("ABC123");
    expect(scriptSrc(csp)).toBe("script-src 'self' 'nonce-ABC123' 'strict-dynamic'");
  });
});

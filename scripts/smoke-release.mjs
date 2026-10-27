import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const buildId = readFileSync(new URL("../.next/BUILD_ID", import.meta.url), "utf8").trim();
const validation = JSON.parse(readFileSync(new URL("../.next/release-validation.json", import.meta.url), "utf8"));
assert.equal(validation.mode, "authenticated", "Falta una compilación autenticada.");
assert.equal(validation.buildId, buildId, "La constancia corresponde a otra compilación. Ejecute npm run build:release.");

// Solo servidor local; no admite URL remota ni credenciales para esta prueba.
const base = "http://127.0.0.1:3001";
const nonces = [];
for (const route of ["/", "/arqueo", "/"]) {
  const response = await fetch(base + route, { redirect: "error" });
  assert.equal(response.status, 200, route);
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /script-src 'self' 'nonce-([^']+)' 'strict-dynamic'/);
  assert.equal(csp.includes("'unsafe-eval'"), false);
  nonces.push(csp.match(/'nonce-([^']+)'/)[1]);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  const html = await response.text();
  assert.equal(html.includes("DEMO · DATOS FICTICIOS"), false, "No se debe servir DEMO en la entrega autenticada.");
  console.log(`HTTP 200 y cabeceras verificadas: ${route}`);
}
assert.equal(new Set(nonces).size, 3, "El nonce debe renovarse por petición.");
// Se rechaza antes de inicializar el Admin SDK o procesar una operación.
const denied = await fetch(base + "/api/admin/mutations", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
assert.equal(denied.status, 401);
assert.equal((await denied.json()).error, "No autenticado.");
console.log("POST administrativo sin credenciales: 401; sin escritura ni sesión real.");
console.log(JSON.stringify({ buildId, mode: validation.mode, pilot: validation.pilot, checks: "passed", workspace: root }, null, 2));

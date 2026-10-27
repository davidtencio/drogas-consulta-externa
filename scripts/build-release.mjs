import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
// Misma carga y precedencia de archivos .env que la compilación de Next.
process.env.NODE_ENV = "production";
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(root, false, { info() {}, error() {} });

const demo = process.env.NEXT_PUBLIC_DEMO_MODE ?? "0";
const pilot = process.env.NEXT_PUBLIC_PILOT_MODE ?? "0";
if (demo !== "0" || !["0", "1"].includes(pilot) || process.env.CODEX_DEMO_PREVIEW === "1") {
  console.error("Entrega rechazada: NEXT_PUBLIC_DEMO_MODE debe ser 0, NEXT_PUBLIC_PILOT_MODE debe ser 0 o 1 y CODEX_DEMO_PREVIEW debe estar desactivado. No se inició la compilación.");
  process.exit(1);
}
console.log(`Modo de entrega comprobado: autenticado; piloto=${pilot}.`);
if (process.argv.includes("--check")) process.exit(0);

const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build"], { cwd: root, env: process.env, stdio: "inherit" });
if (result.error || result.status !== 0) process.exit(result.status || 1);
const buildId = readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8").trim();
writeFileSync(path.join(root, ".next", "release-validation.json"), JSON.stringify({ mode: "authenticated", pilot: pilot === "1", buildId, builtAt: new Date().toISOString() }, null, 2) + "\n");
console.log("Compilación autenticada terminada. Este resultado no confirma aceptación de usuarios ni un despliegue.");

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./build-release.mjs", import.meta.url));
const check = (demo, pilot) => spawnSync(process.execPath, [script, "--check"], {
  encoding: "utf8",
  env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: demo, NEXT_PUBLIC_PILOT_MODE: pilot },
});

for (const pilot of ["0", "1"]) test(`admite una entrega autenticada con piloto=${pilot}`, () => {
  const result = check("0", pilot);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Modo de entrega comprobado: autenticado/);
});
for (const demo of ["1", "true", ""]) test(`rechaza DEMO o una configuración ambigua (${JSON.stringify(demo)}) antes de compilar`, () => {
  const result = check(demo, "0");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No se inició la compilación/);
});
test("rechaza una configuración ambigua del piloto", () => {
  assert.equal(check("0", "true").status, 1);
});
test("rechaza el perfil de vista previa en una entrega", () => {
  const result = spawnSync(process.execPath, [script, "--check"], {
    encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: "0", NEXT_PUBLIC_PILOT_MODE: "0", CODEX_DEMO_PREVIEW: "1" },
  });
  assert.equal(result.status, 1);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("renders the medication inventory product", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../app/api/inventory/route.ts", import.meta.url), "utf8");
  assert.match(page, /Inventario de medicamentos/);
  assert.match(page, /Farmacéuticos autorizados/);
  assert.match(page, /Registrar movimiento/);
  assert.match(api, /stock\+\? >= 0/);
  assert.match(api, /oai-authenticated-user-email/);
});

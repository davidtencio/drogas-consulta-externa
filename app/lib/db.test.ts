import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "new-id" }));
const runTransaction = vi.fn(async () => undefined);
const doc = vi.fn((_db: unknown, col?: string, id?: string) => ({ col, id }));
const collection = vi.fn((_db: unknown, name: string) => ({ name }));
const batchSet = vi.fn();
const batchCommit = vi.fn(async () => undefined);
const writeBatch = vi.fn(() => ({ set: batchSet, commit: batchCommit }));

vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { email: "admin@h.cr", getIdToken: vi.fn(async () => "id-token-123") } },
}));
vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...(a as [])),
  runTransaction: (...a: unknown[]) => runTransaction(...(a as [])),
  doc: (...a: unknown[]) => doc(...(a as [unknown, string, string?])),
  collection: (...a: unknown[]) => collection(...(a as [unknown, string])),
  writeBatch: (...a: unknown[]) => writeBatch(...(a as [])),
}));

import * as dbApi from "./db";

const fields = { name: "Metformina", strength: "500 mg", form: "Tableta", minimumStock: 20, lot: "L1", expiresAt: "2027-01-01", code: "101-20-5001" };

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) }));

beforeEach(() => {
  addDoc.mockClear();
  runTransaction.mockClear();
  doc.mockClear();
  collection.mockClear();
  batchSet.mockClear();
  batchCommit.mockClear();
  fetchMock.mockClear();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});

/** Extrae el cuerpo (op) enviado al backend en la llamada `fetch` número `i`. */
function sentOp(i = 0): Record<string, unknown> {
  const init = fetchMock.mock.calls[i][1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("mutaciones administrativas (vía backend)", () => {
  it("postAdminMutation llama al endpoint con el ID token en el encabezado", async () => {
    await dbApi.setActive("medicines", "abc", false);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/admin/mutations");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer id-token-123");
    expect(sentOp()).toEqual({ op: "setActive", col: "medicines", id: "abc", active: false });
    // Ninguna escritura directa a Firestore desde el cliente.
    expect(batchSet).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
  });

  it("createMedicine envía la operación con existencia inicial y farmacéutico", async () => {
    await dbApi.createMedicine(fields, 5, "ana@h.cr");
    expect(sentOp()).toEqual({ op: "medicine.create", fields, initialStock: 5, pharmacistEmail: "ana@h.cr" });
  });

  it("updateMedicine envía la operación de edición", async () => {
    await dbApi.updateMedicine("m1", fields);
    expect(sentOp()).toEqual({ op: "medicine.update", id: "m1", fields });
  });

  it("createPharmacist envía la operación de alta", async () => {
    await dbApi.createPharmacist({ name: "Ana", email: "ana@h.cr", license: "CF-1" });
    expect(sentOp()).toEqual({ op: "pharmacist.create", fields: { name: "Ana", email: "ana@h.cr", license: "CF-1" } });
  });

  it("propaga el mensaje de error del backend", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "No autorizado." }) });
    await expect(dbApi.setActive("pharmacists", "p1", false)).rejects.toThrow("No autorizado.");
  });
});

describe("registerMovement", () => {
  it("se ejecuta dentro de una transacción (cliente, operador)", async () => {
    await dbApi.registerMovement({ medicineId: "m1", type: "OUT", quantity: 3, prescriptionRef: "RX-1", pharmacistEmail: "ana@h.cr", now: "2026-07-16T10:00:00.000Z" });
    expect(runTransaction).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("registerCount", () => {
  it("agrega un conteo sin transacción (funciona offline) con la evidencia", async () => {
    await dbApi.registerCount({ medicine: { name: "Metformina", stock: 100 }, medicineId: "m1", countedQuantity: 95, note: "faltante", pharmacistEmail: "ana@h.cr", now: "2026-07-16T10:00:00.000Z" });
    expect(runTransaction).not.toHaveBeenCalled();
    expect(addDoc).toHaveBeenCalledTimes(1);
    const rec = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(rec).toMatchObject({ type: "COUNT", quantity: 95, systemQuantity: 100, difference: -5, note: "faltante", medicineName: "Metformina", actorEmail: "admin@h.cr" });
  });
});

describe("registerCounts", () => {
  it("registra varios conteos en un lote (sin transacción) y confirma", async () => {
    await dbApi.registerCounts(
      [
        { medicine: { id: "a", name: "Metformina", stock: 100 }, countedQuantity: 98 },
        { medicine: { id: "b", name: "Ibuprofeno", stock: 40 }, countedQuantity: 45 },
      ],
      "arqueo diario",
      "ana@h.cr",
      "2026-07-16T10:00:00.000Z"
    );
    expect(runTransaction).not.toHaveBeenCalled();
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledOnce();
    const first = batchSet.mock.calls[0][1] as Record<string, unknown>;
    expect(first).toMatchObject({ type: "COUNT", quantity: 98, systemQuantity: 100, difference: -2, note: "arqueo diario" });
    const second = batchSet.mock.calls[1][1] as Record<string, unknown>;
    expect(second).toMatchObject({ type: "COUNT", quantity: 45, difference: 5 });
  });
});

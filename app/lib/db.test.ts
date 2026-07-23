import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "new-id" }));
const runTransaction = vi.fn(async () => undefined);
const doc = vi.fn((_db: unknown, col?: string, id?: string) => ({ col, id }));
const collection = vi.fn((_db: unknown, name: string) => ({ name }));
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn(async () => undefined);
const writeBatch = vi.fn(() => ({ set: batchSet, update: batchUpdate, commit: batchCommit }));

vi.mock("../firebase", () => ({ db: {}, auth: { currentUser: { email: "admin@h.cr" } } }));
vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...(a as [])),
  runTransaction: (...a: unknown[]) => runTransaction(...(a as [])),
  doc: (...a: unknown[]) => doc(...(a as [unknown, string, string?])),
  collection: (...a: unknown[]) => collection(...(a as [unknown, string])),
  writeBatch: (...a: unknown[]) => writeBatch(...(a as [])),
}));

import * as dbApi from "./db";

const fields = { name: "Metformina", strength: "500 mg", form: "Tableta", minimumStock: 20, lot: "L1", expiresAt: "2027-01-01" };

beforeEach(() => {
  addDoc.mockClear();
  runTransaction.mockClear();
  doc.mockClear();
  collection.mockClear();
  batchSet.mockClear();
  batchUpdate.mockClear();
  batchCommit.mockClear();
});

describe("setActive", () => {
  it("actualiza el campo active y su auditoría en un lote atómico", async () => {
    await dbApi.setActive("medicines", "abc", false);
    expect(doc).toHaveBeenCalledWith({}, "medicines", "abc");
    expect(batchUpdate).toHaveBeenCalledWith({ col: "medicines", id: "abc" }, { active: false });
    expect(batchSet.mock.calls[0][1]).toMatchObject({ action: "medicine.deactivate", entityType: "medicine", entityId: "abc", actorEmail: "admin@h.cr" });
    expect(batchCommit).toHaveBeenCalledOnce();
  });
});

describe("createPharmacist", () => {
  it("agrega con active=true y su auditoría en el mismo lote", async () => {
    await dbApi.createPharmacist({ name: "Ana", email: "ana@h.cr", license: "CF-1" }, "2026-07-16T10:00:00.000Z");
    const payload = batchSet.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({ name: "Ana", email: "ana@h.cr", license: "CF-1", active: true, createdAt: "2026-07-16T10:00:00.000Z" });
    expect(batchSet.mock.calls[1][1]).toMatchObject({ action: "pharmacist.create", entityType: "pharmacist", actorEmail: "admin@h.cr" });
    expect(batchCommit).toHaveBeenCalledOnce();
  });
});

describe("createMedicine", () => {
  it("sin existencia inicial escribe medicamento + auditoría en un lote (stock 0, sin movimiento)", async () => {
    await dbApi.createMedicine(fields, 0, "", "2026-07-16T10:00:00.000Z");
    expect(addDoc).not.toHaveBeenCalled();
    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchSet.mock.calls[0][1]).toMatchObject({ stock: 0, active: true });
    expect(batchSet.mock.calls[1][1]).toMatchObject({ action: "medicine.create", entityType: "medicine" });
    expect(batchCommit).toHaveBeenCalledOnce();
  });

  it("con existencia inicial escribe medicamento, movimiento y auditoría en un solo lote atómico", async () => {
    await dbApi.createMedicine(fields, 5, "ana@h.cr", "2026-07-16T10:00:00.000Z");
    expect(batchSet).toHaveBeenCalledTimes(3);
    expect(batchSet.mock.calls[0][1]).toMatchObject({ stock: 5 });
    const movement = batchSet.mock.calls[1][1] as Record<string, unknown>;
    expect(movement).toMatchObject({ type: "IN", quantity: 5, pharmacistEmail: "ana@h.cr", actorEmail: "admin@h.cr", prescriptionRef: "Existencia inicial", medicineName: "Metformina" });
    expect(batchSet.mock.calls[2][1]).toMatchObject({ action: "medicine.create", details: { initialStock: 5 } });
    expect(batchCommit).toHaveBeenCalledOnce();
  });
});

describe("updateMedicine", () => {
  it("actualiza el medicamento y su auditoría en un lote atómico", async () => {
    await dbApi.updateMedicine("m1", fields);
    expect(batchUpdate).toHaveBeenCalledWith({ col: "medicines", id: "m1" }, { ...fields });
    expect(batchSet.mock.calls[0][1]).toMatchObject({ action: "medicine.update", entityId: "m1" });
    expect(batchCommit).toHaveBeenCalledOnce();
  });
});

describe("registerMovement", () => {
  it("se ejecuta dentro de una transacción", async () => {
    await dbApi.registerMovement({ medicineId: "m1", type: "OUT", quantity: 3, prescriptionRef: "RX-1", pharmacistEmail: "ana@h.cr", now: "2026-07-16T10:00:00.000Z" });
    expect(runTransaction).toHaveBeenCalledOnce();
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

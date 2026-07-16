import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "new-id" }));
const updateDoc = vi.fn(async () => undefined);
const runTransaction = vi.fn(async () => undefined);
const doc = vi.fn((_db: unknown, col: string, id?: string) => ({ col, id }));
const collection = vi.fn((_db: unknown, name: string) => ({ name }));

vi.mock("../firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...(a as [])),
  updateDoc: (...a: unknown[]) => updateDoc(...(a as [])),
  runTransaction: (...a: unknown[]) => runTransaction(...(a as [])),
  doc: (...a: unknown[]) => doc(...(a as [unknown, string, string?])),
  collection: (...a: unknown[]) => collection(...(a as [unknown, string])),
}));

import * as dbApi from "./db";

const fields = { name: "Metformina", strength: "500 mg", form: "Tableta", minimumStock: 20, lot: "L1", expiresAt: "2027-01-01" };

beforeEach(() => {
  addDoc.mockClear();
  updateDoc.mockClear();
  runTransaction.mockClear();
  doc.mockClear();
  collection.mockClear();
});

describe("setActive", () => {
  it("actualiza el campo active del documento indicado", async () => {
    await dbApi.setActive("medicines", "abc", false);
    expect(doc).toHaveBeenCalledWith({}, "medicines", "abc");
    expect(updateDoc).toHaveBeenCalledWith({ col: "medicines", id: "abc" }, { active: false });
  });
});

describe("createPharmacist", () => {
  it("agrega con active=true", async () => {
    await dbApi.createPharmacist({ name: "Ana", email: "ana@h.cr", license: "CF-1" }, "2026-07-16T10:00:00.000Z");
    const payload = addDoc.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({ name: "Ana", email: "ana@h.cr", license: "CF-1", active: true, createdAt: "2026-07-16T10:00:00.000Z" });
  });
});

describe("createMedicine", () => {
  it("sin existencia inicial solo crea el medicamento (stock 0, sin movimiento)", async () => {
    await dbApi.createMedicine(fields, 0, "", "2026-07-16T10:00:00.000Z");
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(addDoc.mock.calls[0][1]).toMatchObject({ stock: 0, active: true });
  });

  it("con existencia inicial crea el medicamento y un movimiento de ingreso", async () => {
    await dbApi.createMedicine(fields, 5, "ana@h.cr", "2026-07-16T10:00:00.000Z");
    expect(addDoc).toHaveBeenCalledTimes(2);
    expect(addDoc.mock.calls[0][1]).toMatchObject({ stock: 5 });
    const movement = addDoc.mock.calls[1][1] as Record<string, unknown>;
    expect(movement).toMatchObject({ type: "IN", quantity: 5, pharmacistEmail: "ana@h.cr", prescriptionRef: "Existencia inicial", medicineName: "Metformina" });
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
    expect(rec).toMatchObject({ type: "COUNT", quantity: 95, systemQuantity: 100, difference: -5, note: "faltante", medicineName: "Metformina" });
  });
});

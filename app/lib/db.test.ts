import { describe, it, expect, vi, beforeEach } from "vitest";

const addDoc = vi.fn(async () => ({ id: "new-id" }));
const txGet = vi.fn();
const txUpdate = vi.fn();
const txSet = vi.fn();
const runTransaction = vi.fn(async (_db: unknown, cb: (tx: { get: typeof txGet; update: typeof txUpdate; set: typeof txSet }) => Promise<unknown>) =>
  cb({ get: txGet, update: txUpdate, set: txSet })
);
const doc = vi.fn((_db: unknown, col?: string, id?: string) => ({ col, id }));
const collection = vi.fn((_db: unknown, name: string) => ({ name }));
const batchSet = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn(async () => undefined);
const writeBatch = vi.fn(() => ({ set: batchSet, update: batchUpdate, commit: batchCommit }));

vi.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { email: "admin@h.cr", getIdToken: vi.fn(async () => "id-token-123") } },
}));
vi.mock("firebase/firestore", () => ({
  addDoc: (...a: unknown[]) => addDoc(...(a as [])),
  runTransaction: (...a: unknown[]) => runTransaction(...(a as [unknown, (tx: { get: typeof txGet; update: typeof txUpdate; set: typeof txSet }) => Promise<unknown>])),
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
  txGet.mockReset();
  txUpdate.mockClear();
  txSet.mockClear();
  doc.mockClear();
  collection.mockClear();
  batchSet.mockClear();
  batchUpdate.mockClear();
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

  it("exportDatabaseBackup y resetDatabase invocan el backend administrativo y validan confirmación", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, backup: { version: 1, collections: { medicines: [] } } }),
    });
    const backup = await dbApi.exportDatabaseBackup();
    expect(sentOp()).toEqual({ op: "database.backup" });
    expect(backup).toMatchObject({ version: 1 });

    await expect(dbApi.resetDatabase("NO")).rejects.toThrow(/LIMPIAR/);
    await dbApi.resetDatabase("LIMPIAR");
    expect(sentOp(1)).toEqual({ op: "database.reset", confirm: "LIMPIAR" });
  });
});

describe("registerMovement (transacción y descuento FEFO)", () => {
  it("egresa descontando en orden FEFO entre múltiples lotes y actualiza el lote próximo a vencer", async () => {
    txGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: "Metformina",
        stock: 15,
        lot: "L-PRONTO",
        expiresAt: "2026-11-15",
        lots: [
          { id: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 10, receivedAt: "2026-01-01T00:00:00.000Z" },
          { id: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 5, receivedAt: "2026-02-01T00:00:00.000Z" },
        ],
      }),
    });

    await dbApi.registerMovement({
      medicineId: "m1",
      type: "OUT",
      quantity: 8,
      prescriptionRef: "RX-1",
      note: "Despacho parcial",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    expect(runTransaction).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledOnce();

    const updatedMed = txUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(updatedMed).toEqual({
      stock: 7,
      lot: "L-TARDE",
      expiresAt: "2027-06-01",
      lots: [
        { id: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 7, receivedAt: "2026-01-01T00:00:00.000Z" },
        { id: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 0, receivedAt: "2026-02-01T00:00:00.000Z" },
      ],
    });

    expect(txSet).toHaveBeenCalledOnce();
    const movementDoc = txSet.mock.calls[0][1] as Record<string, unknown>;
    expect(movementDoc).toMatchObject({
      medicineId: "m1",
      medicineName: "Metformina",
      type: "OUT",
      quantity: 8,
      prescriptionRef: "RX-1",
      note: "Despacho parcial",
      pharmacistEmail: "ana@h.cr",
      actorEmail: "admin@h.cr",
      lotAllocations: [
        { lotId: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 5 },
        { lotId: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 3 },
      ],
    });
  });

  it("en empate de fecha de vencimiento desempata por orden de recepción (FIFO)", async () => {
    txGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: "Ibuprofeno",
        stock: 10,
        lots: [
          { id: "lot-2", lot: "L-2", expiresAt: "2027-03-01", quantity: 5, receivedAt: "2026-05-01T00:00:00.000Z" },
          { id: "lot-1", lot: "L-1", expiresAt: "2027-03-01", quantity: 5, receivedAt: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    });

    await dbApi.registerMovement({
      medicineId: "m2",
      type: "OUT",
      quantity: 4,
      prescriptionRef: "RX-2",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    const movementDoc = txSet.mock.calls[0][1] as Record<string, unknown>;
    expect(movementDoc.lotAllocations).toEqual([
      { lotId: "lot-1", lot: "L-1", expiresAt: "2027-03-01", quantity: 4 },
    ]);
  });

  it("migra documento heredado (sin arreglo lots) al descontar egreso", async () => {
    txGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: "Acetaminofén", stock: 10, lot: "LEG-1", expiresAt: "2027-01-10" }),
    });

    await dbApi.registerMovement({
      medicineId: "m-legacy",
      type: "OUT",
      quantity: 10,
      prescriptionRef: "RX-LEG",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    const updatedMed = txUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(updatedMed).toEqual({
      stock: 0,
      lot: "",
      expiresAt: "",
      lots: [{ id: "legacy-m-legacy", lot: "LEG-1", expiresAt: "2027-01-10", quantity: 0, receivedAt: "2026-07-16T10:00:00.000Z" }],
    });
  });

  it("ingresa múltiples lotes recibidos y selecciona como principal el de vencimiento más próximo", async () => {
    txGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ name: "Metformina", stock: 0, lots: [] }),
    });

    await dbApi.registerMovement({
      medicineId: "m1",
      type: "IN",
      quantity: 30,
      receivedLots: [
        { lot: "L-2028", expiresAt: "2028-01-01", quantity: 20 },
        { lot: "L-2027", expiresAt: "2027-02-01", quantity: 10 },
      ],
      prescriptionRef: "FAC-10",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    const updatedMed = txUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(updatedMed).toMatchObject({
      stock: 30,
      lot: "L-2027",
      expiresAt: "2027-02-01",
    });
    expect((updatedMed.lots as unknown[]).length).toBe(2);
  });

  it("fusiona cantidad cuando ingresa un lote existente con igual vencimiento y rechaza vencimiento contradictorio", async () => {
    txGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: "Metformina",
        stock: 10,
        lots: [{ id: "lot-existente", lot: "L-100", expiresAt: "2027-05-01", quantity: 10, receivedAt: "2026-01-01T00:00:00.000Z" }],
      }),
    });

    await dbApi.registerMovement({
      medicineId: "m1",
      type: "IN",
      quantity: 5,
      receivedLots: [{ lot: "L-100", expiresAt: "2027-05-01", quantity: 5 }],
      prescriptionRef: "FAC-11",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    const updatedMed = txUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(updatedMed.lots).toEqual([
      { id: "lot-existente", lot: "L-100", expiresAt: "2027-05-01", quantity: 15, receivedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    txGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: "Metformina",
        stock: 15,
        lots: [{ id: "lot-existente", lot: "L-100", expiresAt: "2027-05-01", quantity: 15, receivedAt: "2026-01-01T00:00:00.000Z" }],
      }),
    });
    await expect(
      dbApi.registerMovement({
        medicineId: "m1",
        type: "IN",
        quantity: 5,
        receivedLots: [{ lot: "L-100", expiresAt: "2028-01-01", quantity: 5 }],
        prescriptionRef: "FAC-12",
        pharmacistEmail: "ana@h.cr",
        now: "2026-07-16T10:00:00.000Z",
      })
    ).rejects.toThrow(/ya existe con vencimiento/i);
  });

  it("rechaza si el medicamento no existe o si las existencias por lote son insuficientes", async () => {
    txGet.mockResolvedValueOnce({ exists: () => false });
    await expect(
      dbApi.registerMovement({ medicineId: "inexistente", type: "OUT", quantity: 1, prescriptionRef: "RX", pharmacistEmail: "ana@h.cr", now: "2026-07-16T10:00:00.000Z" })
    ).rejects.toThrow("Medicamento no disponible.");

    txGet.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        name: "Metformina",
        stock: 10,
        lots: [{ id: "l1", lot: "L1", expiresAt: "2027-01-01", quantity: 2, receivedAt: "2026-01-01T00:00:00.000Z" }],
      }),
    });
    await expect(
      dbApi.registerMovement({ medicineId: "m1", type: "OUT", quantity: 5, prescriptionRef: "RX", pharmacistEmail: "ana@h.cr", now: "2026-07-16T10:00:00.000Z" })
    ).rejects.toThrow("Existencias por lote insuficientes.");
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("omite lotes vencidos en FEFO ordinario y bloquea si solo alcanzan sumando lotes vencidos", async () => {
    const medWithExpired = () => ({
      exists: () => true,
      data: () => ({
        name: "Clonazepam",
        stock: 15,
        lots: [
          { id: "lot-vencido", lot: "L-VENCIDO", expiresAt: "2026-01-01", quantity: 5, receivedAt: "2025-01-01T00:00:00.000Z" },
          { id: "lot-vigente", lot: "L-VIGENTE", expiresAt: "2027-06-01", quantity: 10, receivedAt: "2026-01-01T00:00:00.000Z" },
        ],
      }),
    });

    txGet.mockResolvedValueOnce(medWithExpired());
    await dbApi.registerMovement({
      medicineId: "m-cz",
      type: "OUT",
      quantity: 4,
      prescriptionRef: "RX-VIG",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    const movementDoc = txSet.mock.calls[0][1] as Record<string, unknown>;
    expect(movementDoc.lotAllocations).toEqual([
      { lotId: "lot-vigente", lot: "L-VIGENTE", expiresAt: "2027-06-01", quantity: 4 },
    ]);

    txGet.mockResolvedValueOnce(medWithExpired());
    await expect(
      dbApi.registerMovement({
        medicineId: "m-cz",
        type: "OUT",
        quantity: 12,
        prescriptionRef: "RX-EXCESO",
        pharmacistEmail: "ana@h.cr",
        now: "2026-07-16T10:00:00.000Z",
      })
    ).rejects.toThrow(/existencias vigentes insuficientes/i);
  });

  it("permite seleccionar un lote específico en egresos y descargar lotes vencidos cuando allowExpired está activo", async () => {
    const medLots = () => ({
      exists: () => true,
      data: () => ({
        name: "Clonazepam",
        stock: 15,
        lots: [
          { id: "lot-vencido", lot: "L-VENCIDO", expiresAt: "2026-01-01", quantity: 5, receivedAt: "2025-01-01T00:00:00.000Z" },
          { id: "lot-a", lot: "L-A", expiresAt: "2027-01-01", quantity: 4, receivedAt: "2026-01-01T00:00:00.000Z" },
          { id: "lot-b", lot: "L-B", expiresAt: "2028-01-01", quantity: 6, receivedAt: "2026-02-01T00:00:00.000Z" },
        ],
      }),
    });

    txGet.mockResolvedValueOnce(medLots());
    await dbApi.registerMovement({
      medicineId: "m-cz",
      type: "OUT",
      quantity: 3,
      targetLotId: "lot-b",
      prescriptionRef: "RX-LOT-B",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    expect((txSet.mock.calls[0][1] as Record<string, unknown>).lotAllocations).toEqual([
      { lotId: "lot-b", lot: "L-B", expiresAt: "2028-01-01", quantity: 3 },
    ]);

    txGet.mockResolvedValueOnce(medLots());
    await expect(
      dbApi.registerMovement({
        medicineId: "m-cz",
        type: "OUT",
        quantity: 2,
        targetLotId: "lot-vencido",
        prescriptionRef: "BAJA-1",
        pharmacistEmail: "ana@h.cr",
        now: "2026-07-16T10:00:00.000Z",
      })
    ).rejects.toThrow(/lote seleccionado está vencido/i);

    txGet.mockResolvedValueOnce(medLots());
    await dbApi.registerMovement({
      medicineId: "m-cz",
      type: "OUT",
      quantity: 5,
      targetLotId: "lot-vencido",
      allowExpired: true,
      prescriptionRef: "BAJA-1",
      pharmacistEmail: "ana@h.cr",
      now: "2026-07-16T10:00:00.000Z",
    });

    expect((txSet.mock.calls[1][1] as Record<string, unknown>).lotAllocations).toEqual([
      { lotId: "lot-vencido", lot: "L-VENCIDO", expiresAt: "2026-01-01", quantity: 5 },
    ]);
  });
});

describe("registerCount", () => {
  it("agrega un conteo en lote sin transacción (funciona offline) y desnormaliza lastCountAt/lastCountBy", async () => {
    await dbApi.registerCount({ medicine: { name: "Metformina", stock: 100 }, medicineId: "m1", countedQuantity: 95, note: "faltante", pharmacistEmail: "ana@h.cr", now: "2026-07-16T10:00:00.000Z" });
    expect(runTransaction).not.toHaveBeenCalled();
    expect(batchSet).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(batchCommit).toHaveBeenCalledOnce();
    const rec = batchSet.mock.calls[0][1] as Record<string, unknown>;
    expect(rec).toMatchObject({ type: "COUNT", quantity: 95, systemQuantity: 100, difference: -5, note: "faltante", medicineName: "Metformina", actorEmail: "admin@h.cr" });
    expect(batchUpdate.mock.calls[0][1]).toEqual({ lastCountAt: "2026-07-16T10:00:00.000Z", lastCountBy: "ana@h.cr" });
  });
});

describe("registerCounts", () => {
  it("registra varios conteos en un lote (sin transacción), actualiza lastCountAt/lastCountBy y confirma", async () => {
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
    expect(batchUpdate).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledOnce();
    const first = batchSet.mock.calls[0][1] as Record<string, unknown>;
    expect(first).toMatchObject({ type: "COUNT", quantity: 98, systemQuantity: 100, difference: -2, note: "arqueo diario" });
    const second = batchSet.mock.calls[1][1] as Record<string, unknown>;
    expect(second).toMatchObject({ type: "COUNT", quantity: 45, difference: 5 });
    expect(batchUpdate.mock.calls[0][1]).toEqual({ lastCountAt: "2026-07-16T10:00:00.000Z", lastCountBy: "ana@h.cr" });
    expect(batchUpdate.mock.calls[1][1]).toEqual({ lastCountAt: "2026-07-16T10:00:00.000Z", lastCountBy: "ana@h.cr" });
  });
});

describe("updateMovement (edición de ingresos y egresos con reconciliación de lotes)", () => {
  it("edita un egreso del mismo medicamento (cantidad, receta y farmacéutico) y recalcula lotes FEFO", async () => {
    // El movimiento original descontó 8 unidades (5 de L-PRONTO y 3 de L-TARDE), dejando L-PRONTO en 0 y L-TARDE en 7.
    txGet
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          medicineId: "m1",
          medicineName: "Metformina",
          type: "OUT",
          quantity: 8,
          prescriptionRef: "RX-MAL",
          pharmacistEmail: "ana@h.cr",
          createdAt: "2026-07-16T10:00:00.000Z",
          lotAllocations: [
            { lotId: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 5 },
            { lotId: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 3 },
          ],
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: "Metformina",
          stock: 7,
          lot: "L-TARDE",
          expiresAt: "2027-06-01",
          lots: [
            { id: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 7, receivedAt: "2026-01-01T00:00:00.000Z" },
            { id: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 0, receivedAt: "2026-02-01T00:00:00.000Z" },
          ],
        }),
      });

    await dbApi.updateMovement({
      movementId: "mov-1",
      medicineId: "m1",
      type: "OUT",
      quantity: 3,
      prescriptionRef: "RX-CORREGIDA",
      pharmacistEmail: "carlos@h.cr",
      now: "2026-07-17T12:00:00.000Z",
    });

    expect(txUpdate).toHaveBeenCalledOnce();
    expect(txUpdate.mock.calls[0][1]).toEqual({
      stock: 12,
      lot: "L-PRONTO",
      expiresAt: "2026-11-15",
      lots: [
        { id: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 10, receivedAt: "2026-01-01T00:00:00.000Z" },
        { id: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 2, receivedAt: "2026-02-01T00:00:00.000Z" },
      ],
    });
    expect(txSet).toHaveBeenCalledOnce();
    expect(txSet.mock.calls[0][1]).toMatchObject({
      medicineId: "m1",
      medicineName: "Metformina",
      type: "OUT",
      quantity: 3,
      prescriptionRef: "RX-CORREGIDA",
      pharmacistEmail: "carlos@h.cr",
      createdAt: "2026-07-16T10:00:00.000Z",
      updatedAt: "2026-07-17T12:00:00.000Z",
      actorEmail: "admin@h.cr",
      updatedByEmail: "admin@h.cr",
      lotAllocations: [{ lotId: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 3 }],
      editHistory: [
        {
          editedAt: "2026-07-17T12:00:00.000Z",
          editedByEmail: "admin@h.cr",
          previous: {
            medicineId: "m1",
            medicineName: "Metformina",
            type: "OUT",
            quantity: 8,
            prescriptionRef: "RX-MAL",
            pharmacistEmail: "ana@h.cr",
            lotAllocations: [
              { lotId: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 5 },
              { lotId: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 3 },
            ],
          },
        },
      ],
    });
  });

  it("cambia de medicamento en un egreso: reintegra lotes al medicamento anterior y descuenta del nuevo", async () => {
    txGet
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          medicineId: "m1",
          medicineName: "Metformina",
          type: "OUT",
          quantity: 5,
          prescriptionRef: "RX-10",
          pharmacistEmail: "ana@h.cr",
          createdAt: "2026-07-16T10:00:00.000Z",
          lotAllocations: [{ lotId: "lot-m1", lot: "L-M1", expiresAt: "2027-01-01", quantity: 5 }],
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: "Metformina",
          stock: 15,
          lot: "L-M1",
          expiresAt: "2027-01-01",
          lots: [{ id: "lot-m1", lot: "L-M1", expiresAt: "2027-01-01", quantity: 15, receivedAt: "2026-01-01T00:00:00.000Z" }],
        }),
      })
      .mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          name: "Ibuprofeno",
          stock: 10,
          lot: "L-IBU",
          expiresAt: "2027-05-01",
          lots: [{ id: "lot-ibu", lot: "L-IBU", expiresAt: "2027-05-01", quantity: 10, receivedAt: "2026-01-01T00:00:00.000Z" }],
        }),
      });

    await dbApi.updateMovement({
      movementId: "mov-2",
      medicineId: "m2",
      type: "OUT",
      quantity: 4,
      prescriptionRef: "RX-10-B",
      pharmacistEmail: "carlos@h.cr",
      now: "2026-07-17T12:00:00.000Z",
    });

    expect(txUpdate).toHaveBeenCalledTimes(2);
    // Medicamento anterior (m1) recupera las 5 unidades
    expect(txUpdate.mock.calls[0][1]).toMatchObject({
      stock: 20,
      lots: [{ id: "lot-m1", lot: "L-M1", expiresAt: "2027-01-01", quantity: 20, receivedAt: "2026-01-01T00:00:00.000Z" }],
    });
    // Medicamento nuevo (m2) descuenta las 4 unidades
    expect(txUpdate.mock.calls[1][1]).toMatchObject({
      stock: 6,
      lots: [{ id: "lot-ibu", lot: "L-IBU", expiresAt: "2027-05-01", quantity: 6, receivedAt: "2026-01-01T00:00:00.000Z" }],
    });
    expect(txSet.mock.calls[0][1]).toMatchObject({
      medicineId: "m2",
      medicineName: "Ibuprofeno",
      quantity: 4,
      prescriptionRef: "RX-10-B",
      pharmacistEmail: "carlos@h.cr",
    });
  });

  it("edita un ingreso corrigiendo lote, vencimiento y cantidad, y bloquea reducir bajo lo ya egresado", async () => {
    // Ingreso original de 20 unidades en L-ING, de las cuales ya se egresaron 6 (quedan 14 en stock).
    const movInSnap = () => ({
      exists: () => true,
      data: () => ({
        medicineId: "m1",
        medicineName: "Metformina",
        type: "IN",
        quantity: 20,
        prescriptionRef: "Ingreso",
        pharmacistEmail: "ana@h.cr",
        createdAt: "2026-07-10T10:00:00.000Z",
        lotAllocations: [{ lotId: "lot-ing", lot: "L-ING", expiresAt: "2027-01-01", quantity: 20 }],
      }),
    });
    const medSnap = () => ({
      exists: () => true,
      data: () => ({
        name: "Metformina",
        stock: 14,
        lot: "L-ING",
        expiresAt: "2027-01-01",
        lots: [{ id: "lot-ing", lot: "L-ING", expiresAt: "2027-01-01", quantity: 14, receivedAt: "2026-07-10T10:00:00.000Z" }],
      }),
    });

    // Reducir a 10 (>= 6 egresadas) y corregir código de lote a L-ING-OK es válido: quedan 14 - 20 + 10 = 4 en el lote.
    txGet.mockResolvedValueOnce(movInSnap()).mockResolvedValueOnce(medSnap());
    await dbApi.updateMovement({
      movementId: "mov-in",
      medicineId: "m1",
      type: "IN",
      quantity: 10,
      receivedLots: [{ lot: "L-ING-OK", expiresAt: "2027-03-01", quantity: 10 }],
      prescriptionRef: "Ingreso",
      pharmacistEmail: "carlos@h.cr",
      now: "2026-07-17T12:00:00.000Z",
    });

    expect(txUpdate.mock.calls[0][1]).toEqual({
      stock: 4,
      lot: "L-ING-OK",
      expiresAt: "2027-03-01",
      lots: [{ id: "lot-ing", lot: "L-ING-OK", expiresAt: "2027-03-01", quantity: 4, receivedAt: "2026-07-10T10:00:00.000Z" }],
    });

    // Reducir a 5 (< 6 egresadas) debe fallar porque dejaría el lote con saldo negativo (-1).
    txGet.mockResolvedValueOnce(movInSnap()).mockResolvedValueOnce(medSnap());
    await expect(
      dbApi.updateMovement({
        movementId: "mov-in",
        medicineId: "m1",
        type: "IN",
        quantity: 5,
        receivedLots: [{ lot: "L-ING", expiresAt: "2027-01-01", quantity: 5 }],
        prescriptionRef: "Ingreso",
        pharmacistEmail: "carlos@h.cr",
        now: "2026-07-17T12:00:00.000Z",
      })
    ).rejects.toThrow(/saldo negativo/i);
  });
});

describe("voidMovement (anulación de egresos)", () => {
  const outMovement = {
    medicineId: "m1",
    medicineName: "Metformina",
    type: "OUT",
    quantity: 8,
    prescriptionRef: "RX-MAL",
    pharmacistEmail: "ana@h.cr",
    createdAt: "2026-07-16T10:00:00.000Z",
    lotAllocations: [
      { lotId: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 5 },
      { lotId: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 3 },
    ],
  };
  const medicine = {
    name: "Metformina",
    stock: 7,
    lot: "L-TARDE",
    expiresAt: "2027-06-01",
    lots: [
      { id: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 7, receivedAt: "2026-01-01T00:00:00.000Z" },
      { id: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 0, receivedAt: "2026-02-01T00:00:00.000Z" },
    ],
  };

  it("reintegra existencias y lotes y marca el egreso como anulado sin borrarlo", async () => {
    txGet
      .mockResolvedValueOnce({ exists: () => true, data: () => outMovement })
      .mockResolvedValueOnce({ exists: () => true, data: () => medicine });

    await dbApi.voidMovement({ movementId: "mov-1", reason: "  Receta registrada dos veces  ", now: "2026-07-17T12:00:00.000Z" });

    expect(txSet).not.toHaveBeenCalled();
    expect(txUpdate).toHaveBeenCalledTimes(2);
    expect(txUpdate.mock.calls[0][1]).toMatchObject({
      stock: 15,
      lot: "L-PRONTO",
      expiresAt: "2026-11-15",
      lots: [
        { id: "lot-tarde", lot: "L-TARDE", expiresAt: "2027-06-01", quantity: 10, receivedAt: "2026-01-01T00:00:00.000Z" },
        { id: "lot-pronto", lot: "L-PRONTO", expiresAt: "2026-11-15", quantity: 5, receivedAt: "2026-02-01T00:00:00.000Z" },
      ],
    });
    expect(txUpdate.mock.calls[1][1]).toEqual({
      voidedAt: "2026-07-17T12:00:00.000Z",
      voidReason: "Receta registrada dos veces",
      actorEmail: "admin@h.cr",
      voidedByEmail: "admin@h.cr",
    });
  });

  it("rechaza anular un egreso ya anulado, un ingreso o sin motivo suficiente", async () => {
    txGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...outMovement, voidedAt: "2026-07-17T00:00:00.000Z" }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => medicine });
    await expect(dbApi.voidMovement({ movementId: "mov-1", reason: "Receta registrada dos veces", now: "2026-07-17T12:00:00.000Z" })).rejects.toThrow(/ya fue anulado/);

    txGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...outMovement, type: "IN" }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => medicine });
    await expect(dbApi.voidMovement({ movementId: "mov-1", reason: "Receta registrada dos veces", now: "2026-07-17T12:00:00.000Z" })).rejects.toThrow(/Solo se pueden anular egresos/);

    txGet.mockResolvedValueOnce({ exists: () => true, data: () => outMovement })
      .mockResolvedValueOnce({ exists: () => true, data: () => medicine });
    await expect(dbApi.voidMovement({ movementId: "mov-1", reason: "error", now: "2026-07-17T12:00:00.000Z" })).rejects.toThrow(/motivo/);
    expect(txUpdate).not.toHaveBeenCalled();
  });

  it("impide editar un egreso anulado", async () => {
    txGet.mockResolvedValueOnce({ exists: () => true, data: () => ({ ...outMovement, voidedAt: "2026-07-17T00:00:00.000Z" }) })
      .mockResolvedValueOnce({ exists: () => true, data: () => medicine });
    await expect(dbApi.updateMovement({ movementId: "mov-1", medicineId: "m1", type: "OUT", quantity: 2, prescriptionRef: "RX", pharmacistEmail: "ana@h.cr", now: "2026-07-17T12:00:00.000Z" })).rejects.toThrow(/anulado/);
  });
});


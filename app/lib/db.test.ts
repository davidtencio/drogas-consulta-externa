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

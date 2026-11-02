// Capa de acceso a datos: encapsula las escrituras a Firestore para que la UI
// no dependa directamente del SDK. La lógica de dominio vive en inventory.ts y lots.ts.

import { addDoc, collection, doc, runTransaction, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { prepareCount, prepareMovement, type Medicine, type Movement, type MovementType, type ReceivedLot } from "./inventory";
import { applyLotMovement, normalizeMedicineLots, prepareMovementEdit, type MovementEditRequest } from "./lots";
import { DEMO_MODE, demoClearDatabase, demoCreateMedicine, demoCreatePharmacist, demoExportDatabase, demoRegisterCount, demoRegisterMovement, demoSetActive, demoUpdateMedicine, demoUpdateMovement, demoUpdatePharmacist } from "./demo";
import { validateResetConfirmation, type AdminOp, type MedicineFields, type PharmacistFields } from "./adminMutations";

export type { MedicineFields, PharmacistFields } from "./adminMutations";

function actorEmail(): string {
  const email = auth.currentUser?.email?.trim().toLowerCase();
  if (!email) throw new Error("Sesión no disponible para registrar la trazabilidad.");
  return email;
}

/**
 * Envía una mutación administrativa al backend, que verifica el rol y escribe el
 * dato y su auditoría de forma atómica con el Admin SDK. El cliente ya no escribe
 * el catálogo directamente (las reglas de Firestore lo niegan).
 */
async function postAdminMutation<T = Record<string, unknown>>(op: AdminOp): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sesión no disponible para registrar la trazabilidad.");
  const idToken = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch("/api/admin/mutations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(op),
    });
  } catch {
    throw new Error("Sin conexión con el servidor. Intente de nuevo.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo completar la operación.");
  }
  return (data ?? ({} as T)) as T;
}

/** Registra fallos inesperados para revisión administrativa durante el piloto. */
export async function recordOperationalEvent(type: string, details: Record<string, unknown>): Promise<void> {
  if (DEMO_MODE || !auth.currentUser?.email) return;
  try {
    await addDoc(collection(db, "operationalEvents"), {
      type,
      details,
      actorEmail: actorEmail(),
      createdAt: new Date().toISOString(),
    });
  } catch {
    // El reporte nunca debe provocar un segundo fallo en la interfaz.
  }
}

/** Actualiza los datos de un medicamento (sin tocar existencias) vía backend. */
export async function updateMedicine(id: string, fields: MedicineFields): Promise<void> {
  if (DEMO_MODE) { demoUpdateMedicine(id, fields); return Promise.resolve(); }
  await postAdminMutation({ op: "medicine.update", id, fields });
}

/**
 * Crea un medicamento. Si la existencia inicial es > 0, el backend registra
 * además, en el mismo lote atómico, un movimiento de ingreso trazable con el
 * farmacéutico responsable.
 */
export async function createMedicine(
  fields: MedicineFields,
  initialStock: number,
  pharmacistEmail: string
): Promise<void> {
  if (DEMO_MODE) { demoCreateMedicine({ ...fields, active: true }, initialStock, pharmacistEmail); return; }
  await postAdminMutation({ op: "medicine.create", fields, initialStock, pharmacistEmail });
}

export async function createPharmacist(fields: PharmacistFields): Promise<void> {
  if (DEMO_MODE) { demoCreatePharmacist({ ...fields, active: true }); return Promise.resolve(); }
  await postAdminMutation({ op: "pharmacist.create", fields });
}

export async function updatePharmacist(id: string, fields: PharmacistFields): Promise<void> {
  if (DEMO_MODE) { demoUpdatePharmacist(id, fields); return Promise.resolve(); }
  await postAdminMutation({ op: "pharmacist.update", id, fields });
}

/** Activa o da de baja un registro de medicamentos o farmacéuticos (con auditoría atómica). */
export async function setActive(col: "medicines" | "pharmacists", id: string, active: boolean): Promise<void> {
  if (DEMO_MODE) { demoSetActive(col, id, active); return Promise.resolve(); }
  await postAdminMutation({ op: "setActive", col, id, active });
}

/** Obtiene una copia completa en JSON de todas las colecciones de la base de datos. */
export async function exportDatabaseBackup(): Promise<Record<string, unknown>> {
  if (DEMO_MODE) return Promise.resolve(demoExportDatabase());
  const res = await postAdminMutation<{ backup?: Record<string, unknown> }>({ op: "database.backup" });
  return res.backup ?? {};
}

/** Elimina todos los documentos de la base de datos para iniciar el registro desde cero. */
export async function resetDatabase(confirm: string): Promise<void> {
  validateResetConfirmation(confirm);
  if (DEMO_MODE) { demoClearDatabase(); return Promise.resolve(); }
  await postAdminMutation({ op: "database.reset", confirm });
}

export type MovementRequest = {
  medicineId: string;
  type: MovementType;
  quantity: number;
  prescriptionRef: string;
  note?: string;
  receivedLots?: ReceivedLot[];
  targetLotId?: string;
  allowExpired?: boolean;
  pharmacistEmail: string;
  now: string;
};

/**
 * Registra un movimiento dentro de una transacción: lee las existencias
 * actuales, calcula el nuevo stock (rechaza egresos insuficientes) y persiste
 * el ajuste junto con el registro de bitácora.
 */
export function registerMovement(req: MovementRequest): Promise<void> {
  if (DEMO_MODE) {
    demoRegisterMovement({ medicineId: req.medicineId, type: req.type, quantity: req.quantity, prescriptionRef: req.prescriptionRef, note: req.note, pharmacistEmail: req.pharmacistEmail, createdAt: req.now }, req.receivedLots, { targetLotId: req.targetLotId, allowExpired: req.allowExpired });
    return Promise.resolve();
  }
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "medicines", req.medicineId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Medicamento no disponible.");
    const data = snap.data();
    const lotResult = applyLotMovement(normalizeMedicineLots(data, req.medicineId, req.now), {
      type: req.type,
      quantity: req.quantity,
      receivedLots: req.receivedLots,
      targetLotId: req.targetLotId,
      allowExpired: req.allowExpired,
      now: req.now,
    });
    const { nextStock, record } = prepareMovement(
      { name: data.name, stock: Number(data.stock) || 0 },
      { medicineId: req.medicineId, type: req.type, quantity: req.quantity, prescriptionRef: req.prescriptionRef, note: req.note, lotAllocations: lotResult.allocations, pharmacistEmail: req.pharmacistEmail, createdAt: req.now }
    );
    tx.update(ref, { stock: nextStock, lots: lotResult.lots, lot: lotResult.lot, expiresAt: lotResult.expiresAt });
    tx.set(doc(collection(db, "movements")), { ...record, actorEmail: actorEmail() });
  });
}

export type UpdateMovementRequest = MovementEditRequest;

/**
 * Edita un movimiento de ingreso o egreso dentro de una transacción atómica:
 * revierte el efecto previo en existencias y lotes (del mismo medicamento o del
 * medicamento anterior si cambió), aplica el nuevo movimiento y actualiza la bitácora.
 */
export function updateMovement(req: UpdateMovementRequest): Promise<void> {
  if (DEMO_MODE) {
    demoUpdateMovement(req);
    return Promise.resolve();
  }
  return runTransaction(db, async (tx) => {
    const movRef = doc(db, "movements", req.movementId);
    const movSnap = await tx.get(movRef);
    if (!movSnap.exists()) throw new Error("Movimiento no disponible.");
    const original = { id: req.movementId, ...movSnap.data() } as Movement;
    if (original.type !== "IN" && original.type !== "OUT") {
      throw new Error("Solo se pueden editar ingresos y egresos.");
    }
    const origMedId = original.medicineId || req.medicineId;
    const sameMedicine = origMedId === req.medicineId;
    const origMedRef = doc(db, "medicines", origMedId);
    const nextMedRef = sameMedicine ? origMedRef : doc(db, "medicines", req.medicineId);

    const origMedSnap = await tx.get(origMedRef);
    if (!origMedSnap.exists()) throw new Error("El medicamento original del movimiento ya no existe.");
    const nextMedSnap = sameMedicine ? origMedSnap : await tx.get(nextMedRef);
    if (!nextMedSnap.exists()) throw new Error("Medicamento no disponible.");

    const plan = prepareMovementEdit({
      original,
      originalMedicine: { id: origMedId, ...(origMedSnap.data() as Omit<Medicine, "id">) },
      targetMedicine: { id: req.medicineId, ...(nextMedSnap.data() as Omit<Medicine, "id">) },
      input: req,
    });

    if (plan.previousMedicineUpdate) {
      tx.update(origMedRef, plan.previousMedicineUpdate);
    }
    tx.update(nextMedRef, plan.targetMedicineUpdate);
    const actor = actorEmail();
    tx.set(movRef, {
      ...plan.movementRecord,
      actorEmail: actor,
      updatedAt: req.now,
      updatedByEmail: actor,
    });
  });
}

export type CountRequest = {
  medicine: { name: string; stock: number };
  medicineId: string;
  countedQuantity: number;
  note: string;
  pharmacistEmail: string;
  now: string;
};

/**
 * Registra un conteo físico (arqueo) como evidencia en la bitácora y actualiza
 * la marca de última toma en el medicamento. No usa transacción ni ajusta el
 * stock, por lo que también funciona sin conexión (se encola y sincroniza al reconectar).
 */
export function registerCount(req: CountRequest): Promise<unknown> {
  const record = prepareCount(req.medicine, {
    medicineId: req.medicineId,
    countedQuantity: req.countedQuantity,
    note: req.note,
    pharmacistEmail: req.pharmacistEmail,
    createdAt: req.now,
  });
  if (DEMO_MODE) { demoRegisterCount(record); return Promise.resolve(); }
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "movements")), { ...record, actorEmail: actorEmail() });
  batch.update(doc(db, "medicines", req.medicineId), {
    lastCountAt: req.now,
    lastCountBy: req.pharmacistEmail,
  });
  return batch.commit();
}

export type CountEntry = { medicine: { id: string; name: string; stock: number }; countedQuantity: number };

/**
 * Registra varios conteos (arqueo de sesión) en una sola escritura por lote,
 * actualizando también `lastCountAt` y `lastCountBy` en cada medicamento.
 * No usa transacción ni ajusta stock, así que también funciona sin conexión.
 */
export function registerCounts(entries: readonly CountEntry[], note: string, pharmacistEmail: string, now: string): Promise<void> {
  if (DEMO_MODE) {
    for (const e of entries) {
      demoRegisterCount(prepareCount({ name: e.medicine.name, stock: e.medicine.stock }, { medicineId: e.medicine.id, countedQuantity: e.countedQuantity, note, pharmacistEmail, createdAt: now }));
    }
    return Promise.resolve();
  }
  const batch = writeBatch(db);
  for (const e of entries) {
    const record = prepareCount(
      { name: e.medicine.name, stock: e.medicine.stock },
      { medicineId: e.medicine.id, countedQuantity: e.countedQuantity, note, pharmacistEmail, createdAt: now }
    );
    batch.set(doc(collection(db, "movements")), { ...record, actorEmail: actorEmail() });
    batch.update(doc(db, "medicines", e.medicine.id), {
      lastCountAt: now,
      lastCountBy: pharmacistEmail,
    });
  }
  return batch.commit();
}

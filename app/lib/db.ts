// Capa de acceso a datos: encapsula las escrituras a Firestore para que la UI
// no dependa directamente del SDK. La lógica de dominio vive en inventory.ts.

import { addDoc, collection, doc, runTransaction, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { prepareCount, prepareMovement, type InventoryLot, type LotAllocation, type MovementType, type ReceivedLot } from "./inventory";
import { DEMO_MODE, demoCreateMedicine, demoCreatePharmacist, demoRegisterCount, demoRegisterMovement, demoSetActive, demoUpdateMedicine, demoUpdatePharmacist } from "./demo";

export type MedicineFields = {
  name: string;
  strength: string;
  form: string;
  minimumStock: number;
  lot: string;
  expiresAt: string;
  code: string;
};

export type PharmacistFields = { name: string; email: string; license: string };

function actorEmail(): string {
  const email = auth.currentUser?.email?.trim().toLowerCase();
  if (!email) throw new Error("Sesión no disponible para registrar la trazabilidad.");
  return email;
}

async function addAudit(action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await addDoc(collection(db, "auditLogs"), { action, entityType, entityId, details, actorEmail: actorEmail(), createdAt: new Date().toISOString() });
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

/** Actualiza los datos de un medicamento (sin tocar existencias). */
export async function updateMedicine(id: string, fields: MedicineFields): Promise<void> {
  if (DEMO_MODE) { demoUpdateMedicine(id, fields); return Promise.resolve(); }
  await updateDoc(doc(db, "medicines", id), fields);
  await addAudit("medicine.update", "medicine", id, { name: fields.name });
}

/**
 * Crea un medicamento. Si la existencia inicial es > 0, registra además un
 * movimiento de ingreso trazable con el farmacéutico responsable.
 */
export async function createMedicine(
  fields: MedicineFields,
  initialStock: number,
  pharmacistEmail: string,
  now: string
): Promise<void> {
  if (DEMO_MODE) {
    demoCreateMedicine({ ...fields, active: true }, initialStock);
    return;
  }
  const ref = await addDoc(collection(db, "medicines"), { ...fields, unit: "unidades", stock: initialStock, active: true, createdAt: now });
  if (initialStock > 0) {
    const { record } = prepareMovement(
      { name: fields.name, stock: 0 },
      { medicineId: ref.id, type: "IN", quantity: initialStock, prescriptionRef: "Existencia inicial", pharmacistEmail, createdAt: now }
    );
    await addDoc(collection(db, "movements"), { ...record, actorEmail: actorEmail() });
  }
  await addAudit("medicine.create", "medicine", ref.id, { name: fields.name, initialStock });
}

export async function createPharmacist(fields: PharmacistFields, now: string): Promise<void> {
  if (DEMO_MODE) { demoCreatePharmacist({ ...fields, active: true }); return Promise.resolve(); }
  const ref = await addDoc(collection(db, "pharmacists"), { ...fields, active: true, createdAt: now });
  await addAudit("pharmacist.create", "pharmacist", ref.id, { email: fields.email });
}

export async function updatePharmacist(id: string, fields: PharmacistFields): Promise<void> {
  if (DEMO_MODE) { demoUpdatePharmacist(id, fields); return Promise.resolve(); }
  await updateDoc(doc(db, "pharmacists", id), fields);
  await addAudit("pharmacist.update", "pharmacist", id, { email: fields.email });
}

/** Activa o da de baja un registro de medicamentos o farmacéuticos. */
export async function setActive(col: "medicines" | "pharmacists", id: string, active: boolean): Promise<void> {
  if (DEMO_MODE) { demoSetActive(col, id, active); return Promise.resolve(); }
  await updateDoc(doc(db, col, id), { active });
  await addAudit(`${col === "medicines" ? "medicine" : "pharmacist"}.${active ? "activate" : "deactivate"}`, col.slice(0, -1), id);
}

export type MovementRequest = {
  medicineId: string;
  type: MovementType;
  quantity: number;
  prescriptionRef: string;
  note?: string;
  receivedLots?: ReceivedLot[];
  pharmacistEmail: string;
  now: string;
};

function currentLots(data: Record<string, unknown>, medicineId: string, now: string): InventoryLot[] {
  const stored = Array.isArray(data.lots) ? data.lots as InventoryLot[] : [];
  if (stored.length || !(Number(data.stock) > 0)) return stored.map((lot) => ({ ...lot, quantity: Number(lot.quantity) || 0 }));
  return [{ id: `legacy-${medicineId}`, lot: String(data.lot || "SIN-LOTE"), expiresAt: String(data.expiresAt || ""), quantity: Number(data.stock), receivedAt: now }];
}

function applyLots(lots: InventoryLot[], req: MovementRequest): { lots: InventoryLot[]; allocations: LotAllocation[] } {
  if (req.type === "IN") {
    const incoming = req.receivedLots || [];
    if (!incoming.length) throw new Error("Registre al menos un lote para el ingreso.");
    const next = [...lots];
    const allocations = incoming.map((item, index) => {
      const lotId = `${req.now}-${index}-${item.lot}`;
      next.push({ id: lotId, lot: item.lot, expiresAt: item.expiresAt, quantity: item.quantity, receivedAt: req.now });
      return { lotId, lot: item.lot, expiresAt: item.expiresAt, quantity: item.quantity };
    });
    return { lots: next, allocations };
  }
  let remaining = req.quantity;
  const next = lots.map((lot) => ({ ...lot }));
  const allocations: LotAllocation[] = [];
  const ordered = [...next].filter((lot) => lot.quantity > 0).sort((a,b)=>(a.expiresAt||"9999-12-31").localeCompare(b.expiresAt||"9999-12-31")||a.receivedAt.localeCompare(b.receivedAt));
  for (const lot of ordered) { if (!remaining) break; const used=Math.min(lot.quantity,remaining); lot.quantity-=used;remaining-=used;allocations.push({lotId:lot.id,lot:lot.lot,expiresAt:lot.expiresAt,quantity:used}); }
  if (remaining) throw new Error("Existencias por lote insuficientes.");
  return { lots: next, allocations };
}

/**
 * Registra un movimiento dentro de una transacción: lee las existencias
 * actuales, calcula el nuevo stock (rechaza egresos insuficientes) y persiste
 * el ajuste junto con el registro de bitácora.
 */
export function registerMovement(req: MovementRequest): Promise<void> {
  if (DEMO_MODE) {
    demoRegisterMovement({ medicineId: req.medicineId, type: req.type, quantity: req.quantity, prescriptionRef: req.prescriptionRef, note: req.note, pharmacistEmail: req.pharmacistEmail, createdAt: req.now });
    return Promise.resolve();
  }
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "medicines", req.medicineId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Medicamento no disponible.");
    const data = snap.data();
    const lotResult = applyLots(currentLots(data, req.medicineId, req.now), req);
    const { nextStock, record } = prepareMovement(
      { name: data.name, stock: Number(data.stock) || 0 },
      { medicineId: req.medicineId, type: req.type, quantity: req.quantity, prescriptionRef: req.prescriptionRef, note: req.note, lotAllocations: lotResult.allocations, pharmacistEmail: req.pharmacistEmail, createdAt: req.now }
    );
    const available=lotResult.lots.filter((lot)=>lot.quantity>0).sort((a,b)=>(a.expiresAt||"9999-12-31").localeCompare(b.expiresAt||"9999-12-31"));
    tx.update(ref, { stock: nextStock, lots: lotResult.lots, lot: available[0]?.lot||"", expiresAt: available[0]?.expiresAt||"" });
    tx.set(doc(collection(db, "movements")), { ...record, actorEmail: actorEmail() });
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
 * Registra un conteo físico (arqueo) como evidencia en la bitácora. No usa
 * transacción ni ajusta el stock, por lo que también funciona sin conexión
 * (se encola y sincroniza al reconectar).
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
  return addDoc(collection(db, "movements"), { ...record, actorEmail: actorEmail() });
}

export type CountEntry = { medicine: { id: string; name: string; stock: number }; countedQuantity: number };

/**
 * Registra varios conteos (arqueo de sesión) en una sola escritura por lote.
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
  }
  return batch.commit();
}

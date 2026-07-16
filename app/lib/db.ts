// Capa de acceso a datos: encapsula las escrituras a Firestore para que la UI
// no dependa directamente del SDK. La lógica de dominio vive en inventory.ts.

import { addDoc, collection, doc, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { prepareCount, prepareMovement, type MovementType } from "./inventory";

export type MedicineFields = {
  name: string;
  strength: string;
  form: string;
  minimumStock: number;
  lot: string;
  expiresAt: string;
};

export type PharmacistFields = { name: string; email: string; license: string };

/** Actualiza los datos de un medicamento (sin tocar existencias). */
export function updateMedicine(id: string, fields: MedicineFields): Promise<void> {
  return updateDoc(doc(db, "medicines", id), fields);
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
  const ref = await addDoc(collection(db, "medicines"), { ...fields, unit: "unidades", stock: initialStock, active: true, createdAt: now });
  if (initialStock > 0) {
    const { record } = prepareMovement(
      { name: fields.name, stock: 0 },
      { medicineId: ref.id, type: "IN", quantity: initialStock, prescriptionRef: "Existencia inicial", pharmacistEmail, createdAt: now }
    );
    await addDoc(collection(db, "movements"), record);
  }
}

export function createPharmacist(fields: PharmacistFields, now: string): Promise<unknown> {
  return addDoc(collection(db, "pharmacists"), { ...fields, active: true, createdAt: now });
}

export function updatePharmacist(id: string, fields: PharmacistFields): Promise<void> {
  return updateDoc(doc(db, "pharmacists", id), fields);
}

/** Activa o da de baja un registro de medicamentos o farmacéuticos. */
export function setActive(col: "medicines" | "pharmacists", id: string, active: boolean): Promise<void> {
  return updateDoc(doc(db, col, id), { active });
}

export type MovementRequest = {
  medicineId: string;
  type: MovementType;
  quantity: number;
  prescriptionRef: string;
  pharmacistEmail: string;
  now: string;
};

/**
 * Registra un movimiento dentro de una transacción: lee las existencias
 * actuales, calcula el nuevo stock (rechaza egresos insuficientes) y persiste
 * el ajuste junto con el registro de bitácora.
 */
export function registerMovement(req: MovementRequest): Promise<void> {
  return runTransaction(db, async (tx) => {
    const ref = doc(db, "medicines", req.medicineId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Medicamento no disponible.");
    const data = snap.data();
    const { nextStock, record } = prepareMovement(
      { name: data.name, stock: Number(data.stock) || 0 },
      { medicineId: req.medicineId, type: req.type, quantity: req.quantity, prescriptionRef: req.prescriptionRef, pharmacistEmail: req.pharmacistEmail, createdAt: req.now }
    );
    tx.update(ref, { stock: nextStock });
    tx.set(doc(collection(db, "movements")), record);
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
  return addDoc(collection(db, "movements"), record);
}

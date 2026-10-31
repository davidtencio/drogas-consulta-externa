// Extracción y validación pura de formularios de la interfaz, más asociación
// de mensajes de error al campo correspondiente para enfocar y marcar aria-invalid.

import { isValidMedicineCode, type Medicine, type MovementType, type ReceivedLot } from "./inventory";
import type { MedicineFields, PharmacistFields } from "./adminMutations";

const trimmed = (form: FormData, key: string) => String(form.get(key) || "").trim();

export type ParsedMedicineForm =
  | { kind: "update"; id: string; fields: MedicineFields }
  | { kind: "create"; fields: MedicineFields; initialStock: number; pharmacistEmail: string };

export function parseMedicineForm(form: FormData, editing: Medicine | null): ParsedMedicineForm {
  const name = trimmed(form, "name");
  const strength = trimmed(form, "strength");
  if (!name || !strength) throw new Error("Nombre y concentración son obligatorios.");
  const code = trimmed(form, "code");
  if (code && !isValidMedicineCode(code)) throw new Error("El código debe tener el formato 000-00-0000.");
  const fields: MedicineFields = {
    name,
    strength,
    form: trimmed(form, "form") || "Tableta",
    minimumStock: Math.max(0, Number(form.get("minimumStock")) || 0),
    lot: trimmed(form, "lot"),
    expiresAt: trimmed(form, "expiresAt"),
    code,
  };
  if (editing) return { kind: "update", id: editing.id, fields };

  const initialStock = Math.max(0, Number(form.get("stock")) || 0);
  const pharmacistEmail = trimmed(form, "pharmacistEmail");
  if (initialStock > 0) {
    if (!Number.isInteger(initialStock)) throw new Error("La existencia inicial debe ser un número entero.");
    if (!fields.lot) throw new Error("Indique el lote del ingreso inicial.");
    if (!fields.expiresAt) throw new Error("Indique el vencimiento del ingreso inicial.");
    if (!pharmacistEmail) throw new Error("Seleccione el farmacéutico responsable del ingreso inicial.");
  }
  return { kind: "create", fields, initialStock, pharmacistEmail };
}

export function parsePharmacistForm(form: FormData): PharmacistFields {
  const name = trimmed(form, "name");
  const email = trimmed(form, "email").toLowerCase();
  const license = trimmed(form, "license");
  if (!name || !email || !license) throw new Error("Complete todos los datos del farmacéutico.");
  return { name, email, license };
}

export type ParsedMovementForm = {
  medicineId: string;
  type: MovementType;
  quantity: number;
  receivedLots?: ReceivedLot[];
  prescriptionRef: string;
  note: string;
  pharmacistEmail: string;
};

export function parseMovementForm(form: FormData): ParsedMovementForm {
  const medicineId = trimmed(form, "medicineId");
  const type: MovementType = form.get("type") === "IN" ? "IN" : "OUT";
  const receivedLots: ReceivedLot[] | undefined =
    type === "IN"
      ? form.getAll("lotNumber").map((lot, index) => ({
          lot: String(lot).trim(),
          expiresAt: String(form.getAll("lotExpiresAt")[index] || ""),
          quantity: Number(form.getAll("lotQuantity")[index]),
        }))
      : undefined;
  const quantity = type === "IN" ? receivedLots!.reduce((sum, lot) => sum + lot.quantity, 0) : Number(form.get("quantity"));
  if (type === "IN" && receivedLots!.some((lot) => !lot.lot || !lot.expiresAt || !Number.isInteger(lot.quantity) || lot.quantity <= 0)) {
    throw new Error("Complete correctamente todos los lotes recibidos.");
  }
  const pharmacistEmail = trimmed(form, "pharmacistEmail");
  if (!medicineId) throw new Error("Cantidad inválida.");
  if (!pharmacistEmail) throw new Error("Seleccione el farmacéutico responsable.");
  return {
    medicineId,
    type,
    quantity,
    receivedLots,
    prescriptionRef: trimmed(form, "prescriptionRef"),
    note: trimmed(form, "note"),
    pharmacistEmail,
  };
}

export function parseCountForm(form: FormData, medicine: Medicine | undefined) {
  if (!medicine) throw new Error("Medicamento no disponible.");
  const pharmacistEmail = trimmed(form, "pharmacistEmail");
  if (!pharmacistEmail) throw new Error("Seleccione el farmacéutico responsable.");
  return {
    medicine: { name: medicine.name, stock: medicine.stock },
    medicineId: medicine.id,
    countedQuantity: medicine.stock,
    note: trimmed(form, "note"),
    pharmacistEmail,
  };
}

/** Determina qué campo del formulario debe recibir el foco y `aria-invalid` ante un error. */
export function fieldForFormError(action: string, message: string): string | undefined {
  const lower = message.toLowerCase();
  if (action === "pharmacist") {
    if (lower.includes("correo")) return "email";
    if (lower.includes("código")) return "license";
    if (lower.includes("nombre")) return "name";
    return undefined;
  }
  if (lower.includes("código")) return "code";
  if (lower.includes("concentración")) return "strength";
  if (lower.includes("nombre")) return "name";
  if (lower.includes("existencia")) return action === "movement" ? "quantity" : "stock";
  if (lower.includes("cantidad")) return "quantity";
  if (lower.includes("vencimiento")) return action === "medicine" ? "expiresAt" : "lotExpiresAt";
  if (lower.includes("lote")) return action === "medicine" ? "lot" : "lotNumber";
  if (lower.includes("medicamento")) return "medicineId";
  if (lower.includes("farmacéutico")) return "pharmacistEmail";
  return undefined;
}

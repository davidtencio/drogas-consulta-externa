// Planificación pura (sin Firebase ni red) de las mutaciones administrativas del
// catálogo. Describe QUÉ escrituras debe hacer el backend por cada operación; el
// route handler las ejecuta en un único lote atómico con el Admin SDK. Mantener
// este módulo libre de dependencias del servidor: los tipos también los usa el
// cliente (app/lib/db.ts) para tipar la petición al backend.

import { isValidMedicineCode, prepareMovement } from "./inventory";

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

/** Operación administrativa solicitada por el cliente autenticado. */
export type AdminOp =
  | { op: "medicine.create"; fields: MedicineFields; initialStock: number; pharmacistEmail: string }
  | { op: "medicine.update"; id: string; fields: MedicineFields }
  | { op: "pharmacist.create"; fields: PharmacistFields }
  | { op: "pharmacist.update"; id: string; fields: PharmacistFields }
  | { op: "setActive"; col: "medicines" | "pharmacists"; id: string; active: boolean };

/** Una escritura elemental a persistir dentro del lote atómico. */
export type WriteOp =
  | { kind: "set"; collection: string; id: string; data: Record<string, unknown> }
  | { kind: "add"; collection: string; data: Record<string, unknown> }
  | { kind: "update"; collection: string; id: string; data: Record<string, unknown> };

/** Contexto de confianza que aporta el servidor (nunca el cliente). */
export type PlanContext = {
  /** Correo del actor tomado del token verificado, en minúsculas. */
  actorEmail: string;
  /** Marca de tiempo autoritativa del servidor (ISO). */
  now: string;
  /** Id pre-generado para el documento de una operación de creación. */
  newId: string;
};

const req = (value: string, message: string): string => {
  const v = (value ?? "").trim();
  if (!v) throw new Error(message);
  return v;
};

function auditWrite(
  action: string,
  entityType: string,
  entityId: string,
  ctx: PlanContext,
  details: Record<string, unknown> = {}
): WriteOp {
  return {
    kind: "add",
    collection: "auditLogs",
    data: { action, entityType, entityId, details, actorEmail: ctx.actorEmail, createdAt: ctx.now },
  };
}

function validateMedicine(fields: MedicineFields): void {
  req(fields.name, "Nombre y concentración son obligatorios.");
  req(fields.strength, "Nombre y concentración son obligatorios.");
  if (fields.code && !isValidMedicineCode(fields.code)) {
    throw new Error("El código debe tener el formato 000-00-0000.");
  }
}

function validatePharmacist(fields: PharmacistFields): void {
  req(fields.name, "Complete todos los datos del farmacéutico.");
  req(fields.email, "Complete todos los datos del farmacéutico.");
  req(fields.license, "Complete todos los datos del farmacéutico.");
}

/**
 * Traduce una operación administrativa a la lista de escrituras atómicas que la
 * componen (documento + auditoría, y el movimiento de existencia inicial cuando
 * aplica). Valida las entradas del lado servidor —sin confiar en el cliente— y
 * lanza un Error con mensaje para el usuario ante datos inválidos.
 */
export function planAdminMutation(op: AdminOp, ctx: PlanContext): WriteOp[] {
  switch (op.op) {
    case "medicine.create": {
      validateMedicine(op.fields);
      const initial = op.initialStock;
      if (!Number.isInteger(initial) || initial < 0) {
        throw new Error("La existencia inicial debe ser un número entero.");
      }
      const writes: WriteOp[] = [
        {
          kind: "set",
          collection: "medicines",
          id: ctx.newId,
          data: { ...op.fields, unit: "unidades", stock: initial, active: true, createdAt: ctx.now },
        },
      ];
      if (initial > 0) {
        const pharmacistEmail = req(op.pharmacistEmail, "Seleccione el farmacéutico responsable del ingreso inicial.");
        const { record } = prepareMovement(
          { name: op.fields.name, stock: 0 },
          { medicineId: ctx.newId, type: "IN", quantity: initial, prescriptionRef: "Existencia inicial", pharmacistEmail, createdAt: ctx.now }
        );
        writes.push({ kind: "add", collection: "movements", data: { ...record, actorEmail: ctx.actorEmail } });
      }
      writes.push(auditWrite("medicine.create", "medicine", ctx.newId, ctx, { name: op.fields.name, initialStock: initial }));
      return writes;
    }
    case "medicine.update": {
      const id = req(op.id, "Medicamento no disponible.");
      validateMedicine(op.fields);
      return [
        { kind: "update", collection: "medicines", id, data: { ...op.fields } },
        auditWrite("medicine.update", "medicine", id, ctx, { name: op.fields.name }),
      ];
    }
    case "pharmacist.create": {
      validatePharmacist(op.fields);
      return [
        { kind: "set", collection: "pharmacists", id: ctx.newId, data: { ...op.fields, active: true, createdAt: ctx.now } },
        auditWrite("pharmacist.create", "pharmacist", ctx.newId, ctx, { email: op.fields.email }),
      ];
    }
    case "pharmacist.update": {
      const id = req(op.id, "Farmacéutico no disponible.");
      validatePharmacist(op.fields);
      return [
        { kind: "update", collection: "pharmacists", id, data: { ...op.fields } },
        auditWrite("pharmacist.update", "pharmacist", id, ctx, { email: op.fields.email }),
      ];
    }
    case "setActive": {
      const id = req(op.id, "Registro no disponible.");
      if (op.col !== "medicines" && op.col !== "pharmacists") throw new Error("Colección inválida.");
      const entityType = op.col === "medicines" ? "medicine" : "pharmacist";
      const action = `${entityType}.${op.active ? "activate" : "deactivate"}`;
      return [
        { kind: "update", collection: op.col, id, data: { active: op.active } },
        auditWrite(action, entityType, id, ctx),
      ];
    }
    default:
      throw new Error("Operación no reconocida.");
  }
}

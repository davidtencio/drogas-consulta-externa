// Planificación pura (sin Firebase ni red) de las mutaciones administrativas del
// catálogo. Describe QUÉ escrituras debe hacer el backend por cada operación; el
// route handler las ejecuta en un único lote atómico con el Admin SDK. Mantener
// este módulo libre de dependencias del servidor: los tipos también los usa el
// cliente (app/lib/db.ts) para tipar la petición al backend.

import { isValidMedicineCode, prepareMovement, type InventoryLot, type LotAllocation } from "./inventory";
import { primaryLotSummary } from "./lots";

export { primaryLotSummary } from "./lots";

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
  /** Lotes actuales del medicamento cuando se edita su ficha técnica. */
  existingLots?: readonly InventoryLot[];
  /** Correo registrado actualmente del farmacéutico cuando se edita o cambia su estado. */
  existingPharmacistEmail?: string;
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
      if (initial === 0) {
        return [
          {
            kind: "set",
            collection: "medicines",
            id: ctx.newId,
            data: { ...op.fields, unit: "unidades", stock: 0, lots: [], active: true, createdAt: ctx.now },
          },
          auditWrite("medicine.create", "medicine", ctx.newId, ctx, { name: op.fields.name, initialStock: 0 }),
        ];
      }

      const lot = req(op.fields.lot, "Indique el lote del ingreso inicial.");
      const expiresAt = req(op.fields.expiresAt, "Indique el vencimiento del ingreso inicial.");
      const pharmacistEmail = req(op.pharmacistEmail, "Seleccione el farmacéutico responsable del ingreso inicial.");
      const lotId = `initial-${ctx.newId}`;
      const initialLot: InventoryLot = {
        id: lotId,
        lot,
        expiresAt,
        quantity: initial,
        receivedAt: ctx.now,
      };
      const lotAllocations: LotAllocation[] = [{ lotId, lot, expiresAt, quantity: initial }];
      const { record } = prepareMovement(
        { name: op.fields.name, stock: 0 },
        {
          medicineId: ctx.newId,
          type: "IN",
          quantity: initial,
          prescriptionRef: "Existencia inicial",
          lotAllocations,
          pharmacistEmail,
          createdAt: ctx.now,
        }
      );

      return [
        {
          kind: "set",
          collection: "medicines",
          id: ctx.newId,
          data: {
            ...op.fields,
            lot,
            expiresAt,
            unit: "unidades",
            stock: initial,
            lots: [initialLot],
            active: true,
            createdAt: ctx.now,
          },
        },
        { kind: "add", collection: "movements", data: { ...record, actorEmail: ctx.actorEmail } },
        auditWrite("medicine.create", "medicine", ctx.newId, ctx, { name: op.fields.name, initialStock: initial }),
      ];
    }
    case "medicine.update": {
      const id = req(op.id, "Medicamento no disponible.");
      validateMedicine(op.fields);
      const data: MedicineFields =
        ctx.existingLots && ctx.existingLots.length > 0
          ? { ...op.fields, ...primaryLotSummary(ctx.existingLots) }
          : { ...op.fields };
      return [
        { kind: "update", collection: "medicines", id, data },
        auditWrite("medicine.update", "medicine", id, ctx, { name: op.fields.name }),
      ];
    }
    case "pharmacist.create": {
      validatePharmacist(op.fields);
      const normalizedEmail = op.fields.email.trim().toLowerCase();
      return [
        { kind: "set", collection: "pharmacists", id: ctx.newId, data: { ...op.fields, email: normalizedEmail, active: true, createdAt: ctx.now } },
        { kind: "set", collection: "authorizedOperators", id: normalizedEmail, data: { email: normalizedEmail, pharmacistId: ctx.newId, active: true, updatedAt: ctx.now } },
        auditWrite("pharmacist.create", "pharmacist", ctx.newId, ctx, { email: normalizedEmail }),
      ];
    }
    case "pharmacist.update": {
      const id = req(op.id, "Farmacéutico no disponible.");
      validatePharmacist(op.fields);
      const normalizedEmail = op.fields.email.trim().toLowerCase();
      const prevEmail = ctx.existingPharmacistEmail?.trim().toLowerCase();
      const writes: WriteOp[] = [
        { kind: "update", collection: "pharmacists", id, data: { ...op.fields, email: normalizedEmail } },
        { kind: "set", collection: "authorizedOperators", id: normalizedEmail, data: { email: normalizedEmail, pharmacistId: id, active: true, updatedAt: ctx.now } },
      ];
      if (prevEmail && prevEmail !== normalizedEmail) {
        writes.push({ kind: "set", collection: "authorizedOperators", id: prevEmail, data: { email: prevEmail, pharmacistId: id, active: false, updatedAt: ctx.now } });
      }
      writes.push(auditWrite("pharmacist.update", "pharmacist", id, ctx, { email: normalizedEmail }));
      return writes;
    }
    case "setActive": {
      const id = req(op.id, "Registro no disponible.");
      if (op.col !== "medicines" && op.col !== "pharmacists") throw new Error("Colección inválida.");
      const entityType = op.col === "medicines" ? "medicine" : "pharmacist";
      const action = `${entityType}.${op.active ? "activate" : "deactivate"}`;
      const writes: WriteOp[] = [
        { kind: "update", collection: op.col, id, data: { active: op.active } },
      ];
      const existingEmail = ctx.existingPharmacistEmail?.trim().toLowerCase();
      if (op.col === "pharmacists" && existingEmail) {
        writes.push({
          kind: "set",
          collection: "authorizedOperators",
          id: existingEmail,
          data: { email: existingEmail, pharmacistId: id, active: op.active, updatedAt: ctx.now },
        });
      }
      writes.push(auditWrite(action, entityType, id, ctx));
      return writes;
    }
    default:
      throw new Error("Operación no reconocida.");
  }
}
